/**
 * Plucking rounds (#51–#54, SRS §8; PO decision 2026-10-04: select trees first,
 * then pluck in any order).
 *
 * - Round: planned tree list (ordered) + skipped list; IN_PROGRESS until completed.
 * - TreeHarvest: one per tree per round, enforced by a round "slot" item written in
 *   the same transaction (§8.2 "one tree should normally appear once in a round").
 * - Re-recording a tree edits its harvest (optimistic version); a retried create
 *   with the same client harvestId replays (ADR-0004).
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import {
  INACTIVE_STATUSES,
  SYSTEM_CROPS,
  type TreeStatus,
} from '../../../../src/domain/coconut';
import { txnIds } from '../../../../src/domain/inventory';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  MAX_TREES_PER_ROUND,
  OPEN_ROUND_STATUSES,
  RECORD_QUALITIES,
  type RoundStatus,
  isValidQuantity,
  roundTotal,
} from '../../../../src/domain/plucking';
import {
  type Item,
  createWithAudit,
  getById,
  getItem,
  queryPrefix,
  requireItem,
  toView,
  updateWithAudit,
} from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { ApiError, notFound } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';

const id = z.string().refine(isUlid, 'must be a ULID');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const text = (max: number) => z.string().trim().max(max).nullish();
const treeIds = z
  .array(id)
  .max(MAX_TREES_PER_ROUND)
  .refine(ids => new Set(ids).size === ids.length, 'trees must be unique');

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function loadRound(ctx: TenantContext, roundId: string): Promise<Item> {
  const round = await getById(roundId, ctx);
  if (!round || round['entityType'] !== 'PluckingRound')
    throw notFound('Round not found');
  return round;
}

function assertOpen(round: Item) {
  if (!OPEN_ROUND_STATUSES.includes(round['status'] as RoundStatus)) {
    throw new ApiError('VALIDATION', 'Round is no longer open');
  }
}

/** Active trees of a farm keyed by id; rejects unknown or inactive trees. */
async function requireActiveTrees(
  ctx: TenantContext,
  farmId: string,
  ids: readonly string[]
) {
  const all = await queryPrefix(
    keys.farmPk(ctx.access.tenantId, farmId),
    keys.prefix.trees
  );
  const byId = new Map(all.map(t => [String(t['id']), t]));
  const bad = ids.filter(i => {
    const tree = byId.get(i);
    return !tree || INACTIVE_STATUSES.includes(tree['status'] as TreeStatus);
  });
  if (bad.length > 0)
    throw new ApiError(
      'VALIDATION',
      `plannedTreeIds: ${bad.length} tree(s) not found or inactive`
    );
  return byId;
}

async function roundHarvests(
  ctx: TenantContext,
  roundId: string
): Promise<Item[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': keys.roundPk(ctx.access.tenantId, roundId),
      },
    })
  );
  return (res.Items ?? []).filter(
    i =>
      i['tenantId'] === ctx.access.tenantId && i['entityType'] === 'TreeHarvest'
  );
}

function auditItem(
  ctx: TenantContext,
  entityId: string,
  action: string,
  details: Item
): Item {
  return {
    ...keys.audit(ctx.access.tenantId, entityId, ctx.now, ulid()),
    entityType: 'AuditLog',
    tenantId: ctx.access.tenantId,
    at: ctx.now,
    actorId: ctx.userId,
    action,
    entityId,
    details,
  };
}

// ─── Rounds ─────────────────────────────────────────────────────────────────────

export const createPluckingRound = tenantOperation({
  name: 'createPluckingRound',
  entitlement: 'round.record',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    roundId: id,
    roundDate: isoDate,
    plannedTreeIds: treeIds.refine(
      ids => ids.length > 0,
      'select at least one tree'
    ),
    pluckerName: text(80),
    notes: text(1000),
  }),
  handler: async (input, ctx) => {
    await requireItem(
      keys.farm(ctx.access.tenantId, input.farmId),
      ctx,
      'Farm'
    );
    await requireActiveTrees(ctx, input.farmId, input.plannedTreeIds);
    const item = await createWithAudit({
      ctx,
      key: keys.round(
        ctx.access.tenantId,
        input.farmId,
        input.roundDate,
        input.roundId
      ),
      id: input.roundId,
      entityType: 'PluckingRound',
      attributes: {
        farmId: input.farmId,
        roundDate: input.roundDate,
        plannedTreeIds: input.plannedTreeIds,
        skippedTreeIds: [],
        status: 'IN_PROGRESS',
        pluckerName: input.pluckerName ?? undefined,
        notes: input.notes ?? undefined,
      },
      action: 'round.create',
    });
    return toView(item);
  },
});

export const listPluckingRounds = tenantOperation({
  name: 'listPluckingRounds',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    limit: z.number().int().min(1).max(200).nullish(),
  }),
  handler: async (input, ctx) => {
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      keys.prefix.rounds
    );
    return items
      .sort((a, b) => String(b['SK']).localeCompare(String(a['SK']))) // newest first
      .slice(0, input.limit ?? 50)
      .map(i => toView(i));
  },
});

export const getPluckingRound = tenantOperation({
  name: 'getPluckingRound',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), roundId: id }),
  handler: async (input, ctx) => {
    const round = await loadRound(ctx, input.roundId);
    const harvests = await roundHarvests(ctx, input.roundId);
    return {
      round: toView(round),
      harvests: harvests.filter(h => !h['deletedAt']).map(h => toView(h)),
    };
  },
});

export const updateRoundPlan = tenantOperation({
  name: 'updateRoundPlan',
  entitlement: 'round.record',
  input: z.object({
    tenantId: z.string().min(1),
    roundId: id,
    expectedVersion: z.number().int().positive(),
    addTreeIds: treeIds.nullish(),
    removeTreeIds: treeIds.nullish(),
    skipTreeIds: treeIds.nullish(),
    unskipTreeIds: treeIds.nullish(),
    pluckerName: text(80),
    notes: text(1000),
  }),
  handler: async (input, ctx) => {
    const round = await loadRound(ctx, input.roundId);
    assertOpen(round);
    const farmId = String(round['farmId']);
    const recorded = new Set(
      (await roundHarvests(ctx, input.roundId)).map(h => String(h['treeId']))
    );

    let planned = [...((round['plannedTreeIds'] as string[]) ?? [])];
    let skipped = new Set((round['skippedTreeIds'] as string[]) ?? []);

    if (input.addTreeIds?.length) {
      await requireActiveTrees(ctx, farmId, input.addTreeIds);
      planned = [
        ...planned,
        ...input.addTreeIds.filter(t => !planned.includes(t)),
      ];
    }
    for (const t of input.removeTreeIds ?? []) {
      if (recorded.has(t))
        throw new ApiError(
          'VALIDATION',
          'removeTreeIds: a recorded tree cannot be removed'
        );
      planned = planned.filter(p => p !== t);
      skipped.delete(t);
    }
    for (const t of input.skipTreeIds ?? []) {
      if (recorded.has(t))
        throw new ApiError(
          'VALIDATION',
          'skipTreeIds: a recorded tree cannot be skipped'
        );
      if (planned.includes(t)) skipped.add(t);
    }
    for (const t of input.unskipTreeIds ?? []) skipped.delete(t);
    if (planned.length > MAX_TREES_PER_ROUND) {
      throw new ApiError(
        'VALIDATION',
        `plannedTreeIds: at most ${MAX_TREES_PER_ROUND} trees per round`
      );
    }
    skipped = new Set([...skipped].filter(t => planned.includes(t)));

    const updated = await updateWithAudit({
      ctx,
      key: { PK: String(round['PK']), SK: String(round['SK']) },
      expectedVersion: input.expectedVersion,
      changes: {
        plannedTreeIds: planned,
        skippedTreeIds: [...skipped],
        pluckerName: input.pluckerName,
        notes: input.notes,
      },
      action: 'round.updatePlan',
    });
    return toView(updated);
  },
});

// ─── Tree harvests ──────────────────────────────────────────────────────────────

export const recordTreeHarvest = tenantOperation({
  name: 'recordTreeHarvest',
  entitlement: 'harvest.record',
  input: z.object({
    tenantId: z.string().min(1),
    roundId: id,
    treeId: id,
    harvestId: id,
    quantity: z
      .number()
      .refine(isValidQuantity, 'must be a whole number of nuts (0–500)'),
    recordQuality: z.enum(RECORD_QUALITIES).nullish(),
    notes: text(1000),
    excludeFromPrediction: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const round = await loadRound(ctx, input.roundId);
    assertOpen(round);
    if (!((round['plannedTreeIds'] as string[]) ?? []).includes(input.treeId)) {
      throw new ApiError(
        'VALIDATION',
        'treeId: add the tree to the round first'
      );
    }
    const tree = await getById(input.treeId, ctx);
    if (
      !tree ||
      tree['entityType'] !== 'Tree' ||
      tree['farmId'] !== round['farmId']
    ) {
      throw notFound('Tree not found');
    }

    const TableName = tableName();
    const harvestDate = String(round['roundDate']);
    const slotKey = keys.roundSlot(tenantId, input.roundId, input.treeId);
    const values = {
      quantity: input.quantity,
      quantityUnit: 'NUT',
      recordQuality: input.recordQuality ?? 'CONFIRMED',
      excludeFromPrediction: input.excludeFromPrediction ?? false,
      notes: input.notes ?? undefined,
    };

    const existingSlot = await getItem(slotKey);
    if (!existingSlot) {
      const harvest: Item = {
        ...keys.harvest(tenantId, input.treeId, harvestDate, input.harvestId),
        ...keys.harvestByRound(tenantId, input.roundId, String(tree['code'])),
        ...keys.byId(input.harvestId),
        GSI2SK: 'TREEHARVEST',
        entityType: 'TreeHarvest',
        id: input.harvestId,
        tenantId,
        farmId: round['farmId'],
        roundId: input.roundId,
        treeId: input.treeId,
        treeCode: tree['code'],
        harvestDate,
        ...values,
        photoIds: [],
        source: 'LIVE_APP',
        version: 1,
        createdAt: ctx.now,
        createdBy: ctx.userId,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
      };
      try {
        await ddb.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName,
                  Item: {
                    ...slotKey,
                    tenantId,
                    roundId: input.roundId,
                    treeId: input.treeId,
                    harvestId: input.harvestId,
                    harvestDate,
                  },
                  ConditionExpression: 'attribute_not_exists(PK)',
                },
              },
              {
                Put: {
                  TableName,
                  Item: harvest,
                  ConditionExpression: 'attribute_not_exists(PK)',
                },
              },
              {
                Put: {
                  TableName,
                  Item: auditItem(ctx, input.harvestId, 'harvest.record', {
                    roundId: input.roundId,
                    ...values,
                  }),
                },
              },
            ],
          })
        );
        return toView(harvest);
      } catch (e) {
        if (!(e instanceof TransactionCanceledException)) throw e;
        // Someone (or a retry) filled the slot first → fall through to edit path
      }
    }

    // Edit path: the tree already has a harvest in this round
    const slot = (await getItem(slotKey)) as Item;
    const key = keys.harvest(
      tenantId,
      input.treeId,
      String(slot['harvestDate']),
      String(slot['harvestId'])
    );
    const current = await requireItem(key, ctx, 'Harvest');
    const unchanged = Object.entries(values).every(
      ([k, v]) => (current[k] ?? undefined) === v
    );
    if (unchanged) return toView(current); // idempotent replay
    const updated = await updateWithAudit({
      ctx,
      key,
      expectedVersion: Number(current['version']),
      changes: values,
      action: 'harvest.update',
    });
    return toView(updated);
  },
});

// ─── Completion → produce inventory (#55, AC-PR-005/006, CALC-015) ──────────────

export const completePluckingRound = tenantOperation({
  name: 'completePluckingRound',
  entitlement: 'round.record',
  input: z.object({
    tenantId: z.string().min(1),
    roundId: id,
    expectedVersion: z.number().int().positive(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const round = await loadRound(ctx, input.roundId);
    // Idempotent: a retried completion returns the completed round (no second batch)
    if (round['status'] === 'COMPLETE') return toView(round);
    assertOpen(round);
    if (round['version'] !== input.expectedVersion) {
      throw new ApiError('CONFLICT', 'Round changed; reload and try again');
    }

    const harvests = (await roundHarvests(ctx, input.roundId)).filter(
      h => !h['deletedAt']
    );
    if (harvests.length === 0)
      throw new ApiError(
        'VALIDATION',
        'Record at least one tree before completing'
      );

    const planned = (round['plannedTreeIds'] as string[]) ?? [];
    const recorded = new Set(harvests.map(h => String(h['treeId'])));
    // Planned trees never recorded are closed as skipped (no zero harvests, DQ-001)
    const skipped = [
      ...new Set([
        ...((round['skippedTreeIds'] as string[]) ?? []),
        ...planned.filter(t => !recorded.has(t)),
      ]),
    ];
    const total = roundTotal(
      harvests.map(h => ({
        treeId: String(h['treeId']),
        quantity: h['quantity'] as number,
      }))
    );

    const TableName = tableName();
    const farmId = String(round['farmId']);
    const batchDate = String(round['roundDate']);
    const batchId = ulid();
    const txnId = txnIds.roundHarvestIn(input.roundId);

    const completed: Item = {
      ...round,
      status: 'COMPLETE',
      skippedTreeIds: skipped,
      totalNuts: total,
      batchId: total > 0 ? batchId : undefined,
      completedAt: ctx.now,
      completedBy: ctx.userId,
      version: input.expectedVersion + 1,
      updatedAt: ctx.now,
      updatedBy: ctx.userId,
    };

    const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [
      {
        Put: {
          TableName,
          Item: completed,
          ConditionExpression: 'version = :v AND tenantId = :t',
          ExpressionAttributeValues: {
            ':v': input.expectedVersion,
            ':t': tenantId,
          },
        },
      },
      {
        Put: {
          TableName,
          Item: auditItem(ctx, input.roundId, 'round.complete', {
            totalNuts: total,
            recorded: recorded.size,
          }),
        },
      },
    ];

    if (total > 0) {
      items.push(
        {
          Put: {
            TableName,
            Item: {
              ...keys.produceBatch(
                tenantId,
                farmId,
                SYSTEM_CROPS.COCONUT.code,
                batchDate,
                batchId
              ),
              ...keys.byId(batchId),
              GSI2SK: 'PRODUCEBATCH',
              entityType: 'ProduceBatch',
              id: batchId,
              tenantId,
              farmId,
              cropCode: SYSTEM_CROPS.COCONUT.code,
              sourceType: 'PLUCKING_ROUND',
              sourceId: input.roundId,
              batchDate,
              quantityReceived: total,
              unit: 'NUT',
              // Cached balance, updated in the same transaction as every txn (ADR-0002)
              available: total,
              availableByState: { HUSKED: total, DEHUSKED: 0 },
              status: 'AVAILABLE',
              version: 1,
              createdAt: ctx.now,
              createdBy: ctx.userId,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Put: {
            TableName,
            Item: {
              ...keys.produceTxn(tenantId, batchId, batchDate, txnId),
              entityType: 'ProduceInventoryTxn',
              id: txnId,
              tenantId,
              farmId,
              batchId,
              transactionType: 'HARVEST_IN',
              quantity: total,
              unit: 'NUT',
              state: 'HUSKED',
              transactionDate: batchDate,
              sourceId: input.roundId,
              createdAt: ctx.now,
              createdBy: ctx.userId,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        }
      );
    }

    try {
      await ddb.send(
        new TransactWriteCommand({
          // DynamoDB also de-duplicates identical retries for 10 minutes
          ClientRequestToken: `complete-${input.roundId}-v${input.expectedVersion}`,
          TransactItems: items,
        })
      );
      return toView(completed);
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      const latest = await loadRound(ctx, input.roundId);
      if (latest['status'] === 'COMPLETE') return toView(latest); // completed by an earlier attempt
      throw new ApiError('CONFLICT', 'Round changed; reload and try again');
    }
  },
});
