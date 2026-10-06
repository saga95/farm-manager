/**
 * Historical backfill (#101, SRS §18, §41.13, AC-BF-001..005, US-021).
 *
 * - backfillRound: a past plucking round from WhatsApp or notes. Per-tree
 *   counts only where the tree is KNOWN; nuts that can't be tied to a tree go
 *   in `unattributedQuantity` (round totals stay honest, no tree prediction is
 *   fed by a guess). The original date is the harvest date; the record's
 *   creation time is kept separately (AC-BF-002); the source is stored
 *   (AC-BF-003); uncertain counts are APPROXIMATE (AC-BF-004); the whole round
 *   can be excluded from prediction (AC-BF-005). Old nuts were sold or used
 *   back then, so stock is NOT touched unless asked.
 * - setHarvestPredictionUse: include / exclude any harvest from prediction.
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import { SYSTEM_CROPS } from '../../../../src/domain/coconut';
import { txnIds } from '../../../../src/domain/inventory';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  MAX_TREES_PER_ROUND,
  isValidQuantity,
} from '../../../../src/domain/plucking';
import {
  type Item,
  getById,
  getItem,
  queryPrefix,
  requireItem,
  toView,
  updateWithAudit,
} from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { jsonArg } from '../lib/json';
import { ApiError, notFound } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';
import { refreshTreeSnapshot } from '../lib/treeSnapshot';

type TxItems = NonNullable<TransactWriteCommandInput['TransactItems']>;

const id = z.string().refine(isUlid, 'must be a ULID');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
export const BACKFILL_SOURCES = [
  'WHATSAPP_BACKFILL',
  'MANUAL_BACKFILL',
] as const;

function audit(
  ctx: TenantContext,
  entityId: string,
  action: string,
  details: Item
) {
  return {
    Put: {
      TableName: tableName(),
      Item: {
        ...keys.audit(ctx.access.tenantId, entityId, ctx.now, ulid()),
        entityType: 'AuditLog',
        tenantId: ctx.access.tenantId,
        at: ctx.now,
        actorId: ctx.userId,
        action,
        entityId,
        details,
      },
    },
  };
}

async function put(items: TxItems): Promise<boolean> {
  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: items }));
    return true;
  } catch (e) {
    if (e instanceof TransactionCanceledException) return false; // already there (retry)
    throw e;
  }
}

export const backfillRound = tenantOperation({
  name: 'backfillRound',
  entitlement: 'backfill.record',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    roundId: id,
    roundDate: isoDate,
    source: z.enum(BACKFILL_SOURCES),
    // AWSJSON: a string from AppSync, an array from tests (#24 found this)
    entries: jsonArg(
      z
        .array(
          z.object({
            treeId: id,
            harvestId: id,
            quantity: z
              .number()
              .refine(
                isValidQuantity,
                'must be a whole number of nuts (0–500)'
              ),
            approximate: z.boolean().nullish(),
          })
        )
        .max(MAX_TREES_PER_ROUND)
    ),
    unattributedQuantity: z.number().int().min(0).max(100_000).nullish(),
    approximate: z.boolean().nullish(),
    excludeFromPrediction: z.boolean().nullish(),
    addToStock: z.boolean().nullish(),
    pluckerName: z.string().trim().max(120).nullish(),
    notes: z.string().trim().max(2000).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    if (input.roundDate > ctx.now.slice(0, 10))
      throw new ApiError(
        'VALIDATION',
        'roundDate: a past round cannot be in the future'
      );
    const unattributed = input.unattributedQuantity ?? 0;
    if (input.entries.length === 0 && unattributed === 0)
      throw new ApiError(
        'VALIDATION',
        'entries: add at least one tree count or a total'
      );
    const treeIds = input.entries.map(e => e.treeId);
    if (new Set(treeIds).size !== treeIds.length)
      throw new ApiError('VALIDATION', 'entries: each tree once per round');
    await requireItem(keys.farm(tenantId, input.farmId), ctx, 'Farm');

    // Trees are matched by id only (never guessed); any status, since a tree
    // that is dead or removed today may have produced back then.
    const trees = new Map(
      (
        await queryPrefix(
          keys.farmPk(tenantId, input.farmId),
          keys.prefix.trees
        )
      )
        .filter(t => t['tenantId'] === tenantId && t['entityType'] === 'Tree')
        .map(t => [String(t['id']), t])
    );
    for (const e of input.entries)
      if (!trees.has(e.treeId)) throw notFound('Tree not found');

    const roundKey = keys.round(
      tenantId,
      input.farmId,
      input.roundDate,
      input.roundId
    );
    const existing = await getItem(roundKey);
    if (existing && existing['createdBy'] !== ctx.userId)
      throw new ApiError('CONFLICT', 'Id already in use');

    const attributed = input.entries.reduce((s, e) => s + e.quantity, 0);
    const total = attributed + unattributed;
    const addToStock = Boolean(input.addToStock) && total > 0;
    const batchId = addToStock ? ulid() : undefined;
    const roundApprox = Boolean(input.approximate);

    if (!existing) {
      const round: Item = {
        ...roundKey,
        ...keys.byId(input.roundId),
        GSI2SK: 'PLUCKINGROUND',
        entityType: 'PluckingRound',
        id: input.roundId,
        tenantId,
        farmId: input.farmId,
        roundDate: input.roundDate,
        plannedTreeIds: treeIds,
        skippedTreeIds: [],
        status: 'COMPLETE',
        totalNuts: total,
        unattributedQuantity: unattributed || undefined,
        batchId,
        source: input.source,
        backfilled: true,
        recordQuality: roundApprox ? 'APPROXIMATE' : 'CONFIRMED',
        excludeFromPrediction: Boolean(input.excludeFromPrediction),
        pluckerName: input.pluckerName ?? undefined,
        notes: input.notes ?? undefined,
        // AC-BF-002: original date (roundDate) vs when it was entered
        recordCreatedAt: ctx.now,
        completedAt: ctx.now,
        completedBy: ctx.userId,
        version: 1,
        createdAt: ctx.now,
        createdBy: ctx.userId,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
      };
      const items: TxItems = [
        {
          Put: {
            TableName: tableName(),
            Item: Object.fromEntries(
              Object.entries(round).filter(([, v]) => v !== undefined)
            ),
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        audit(ctx, input.roundId, 'round.backfill', {
          source: input.source,
          roundDate: input.roundDate,
          trees: treeIds.length,
          unattributed,
          totalNuts: total,
        }),
      ];
      if (addToStock && batchId) {
        const txnId = txnIds.roundHarvestIn(input.roundId);
        items.push(
          {
            Put: {
              TableName: tableName(),
              Item: {
                ...keys.produceBatch(
                  tenantId,
                  input.farmId,
                  SYSTEM_CROPS.COCONUT.code,
                  input.roundDate,
                  batchId
                ),
                ...keys.byId(batchId),
                GSI2SK: 'PRODUCEBATCH',
                entityType: 'ProduceBatch',
                id: batchId,
                tenantId,
                farmId: input.farmId,
                cropCode: SYSTEM_CROPS.COCONUT.code,
                sourceType: 'PLUCKING_ROUND',
                sourceId: input.roundId,
                batchDate: input.roundDate,
                quantityReceived: total,
                unit: 'NUT',
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
              TableName: tableName(),
              Item: {
                ...keys.produceTxn(tenantId, batchId, input.roundDate, txnId),
                entityType: 'ProduceInventoryTxn',
                id: txnId,
                tenantId,
                farmId: input.farmId,
                batchId,
                transactionType: 'HARVEST_IN',
                quantity: total,
                unit: 'NUT',
                state: 'HUSKED',
                transactionDate: input.roundDate,
                sourceId: input.roundId,
                createdAt: ctx.now,
                createdBy: ctx.userId,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          }
        );
      }
      if (!(await put(items))) {
        const again = await getItem(roundKey);
        if (!again || again['createdBy'] !== ctx.userId)
          throw new ApiError('CONFLICT', 'Id already in use');
      }
    }

    // One harvest per known tree (retry-safe: each is a conditional put)
    for (const e of input.entries) {
      const tree = trees.get(e.treeId)!;
      const harvest: Item = {
        ...keys.harvest(tenantId, e.treeId, input.roundDate, e.harvestId),
        ...keys.harvestByRound(tenantId, input.roundId, String(tree['code'])),
        ...keys.byId(e.harvestId),
        GSI2SK: 'TREEHARVEST',
        entityType: 'TreeHarvest',
        id: e.harvestId,
        tenantId,
        farmId: input.farmId,
        roundId: input.roundId,
        treeId: e.treeId,
        treeCode: tree['code'],
        harvestDate: input.roundDate,
        quantity: e.quantity,
        quantityUnit: 'NUT',
        recordQuality:
          e.approximate || roundApprox ? 'APPROXIMATE' : 'CONFIRMED',
        excludeFromPrediction: Boolean(input.excludeFromPrediction),
        source: input.source,
        backfilled: true,
        recordCreatedAt: ctx.now,
        photoIds: [],
        version: 1,
        createdAt: ctx.now,
        createdBy: ctx.userId,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
      };
      await put([
        {
          Put: {
            TableName: tableName(),
            Item: harvest,
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
      ]);
    }
    for (const treeId of treeIds) await refreshTreeSnapshot(ctx, treeId);
    return toView((await getItem(roundKey)) as Item);
  },
});

export const setHarvestPredictionUse = tenantOperation({
  name: 'setHarvestPredictionUse',
  entitlement: 'record.edit',
  input: z.object({
    tenantId: z.string().min(1),
    harvestId: id,
    expectedVersion: z.number().int().positive(),
    excludeFromPrediction: z.boolean(),
  }),
  handler: async (input, ctx) => {
    const h = await getById(input.harvestId, ctx);
    if (!h || h['entityType'] !== 'TreeHarvest')
      throw notFound('Harvest not found');
    if (Boolean(h['excludeFromPrediction']) === input.excludeFromPrediction)
      return toView(h);
    const item = await updateWithAudit({
      ctx,
      key: { PK: String(h['PK']), SK: String(h['SK']) },
      expectedVersion: input.expectedVersion,
      changes: { excludeFromPrediction: input.excludeFromPrediction },
      action: input.excludeFromPrediction
        ? 'harvest.excludeFromPrediction'
        : 'harvest.includeInPrediction',
    });
    await refreshTreeSnapshot(ctx, String(h['treeId']));
    return toView(item);
  },
});

/** SCR-011 tree harvest detail (#58): the harvest, its sample and round. */
export const getHarvest = tenantOperation({
  name: 'getHarvest',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), harvestId: id }),
  handler: async (input, ctx) => {
    const h = await getById(input.harvestId, ctx);
    if (!h || h['entityType'] !== 'TreeHarvest')
      throw notFound('Harvest not found');
    const [sample, round] = await Promise.all([
      getItem(
        keys.sample(
          ctx.access.tenantId,
          String(h['treeId']),
          String(h['harvestDate']),
          input.harvestId
        )
      ),
      h['roundId']
        ? getById(String(h['roundId']), ctx)
        : Promise.resolve(undefined),
    ]);
    return {
      harvest: toView(h),
      sample:
        sample &&
        sample['tenantId'] === ctx.access.tenantId &&
        !sample['deletedAt']
          ? toView(sample)
          : null,
      round:
        round && round['entityType'] === 'PluckingRound'
          ? {
              id: round['id'],
              roundDate: round['roundDate'],
              status: round['status'],
              deletedAt: round['deletedAt'] ?? null,
              version: round['version'],
            }
          : null,
    };
  },
});
