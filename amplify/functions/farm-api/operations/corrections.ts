/**
 * Corrections after the fact (#56, #57, SRS §31, AC-PR-007, DQ-005).
 *
 * - correctTreeHarvest: change a recorded count. On a COMPLETE round the
 *   difference is booked to the round's produce batch as an ADJUSTMENT_IN/OUT
 *   transaction, so stock stays reconcilable; the previous quantity and who
 *   changed it are kept on the harvest and in the audit log.
 * - archive/restore a harvest or a whole round: soft delete. Deleted records are
 *   excluded from totals, stock, analytics and prediction; restoring puts them
 *   (and their stock) back.
 *
 * Every write is a version-conditioned Put in ONE transaction; the stock
 * transaction id is deterministic (RECON#<entity>#v<version>), so a retry can
 * never book a difference twice (ADR-0004). Stock that has already left the
 * batch (sold, used, dehusked) can't be taken back: that is a CONFLICT the
 * user resolves with a stock adjustment instead.
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import { SYSTEM_CROPS } from '../../../../src/domain/coconut';
import { txnIds } from '../../../../src/domain/inventory';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  RECORD_QUALITIES,
  isValidQuantity,
} from '../../../../src/domain/plucking';
import { type Item, getById, getItem, toView } from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { ApiError, notFound } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';
import { refreshTreeSnapshot } from '../lib/treeSnapshot';

type TxItems = NonNullable<TransactWriteCommandInput['TransactItems']>;

const id = z.string().refine(isUlid, 'must be a ULID');
const reason = z.string().trim().max(500).nullish();

/** Put `next` only if the stored item is still at `version`. */
function versionedPut(ctx: TenantContext, next: Item, version: number) {
  return {
    Put: {
      TableName: tableName(),
      Item: next,
      ConditionExpression: 'version = :v AND tenantId = :t',
      ExpressionAttributeValues: { ':v': version, ':t': ctx.access.tenantId },
    },
  };
}

function bump(ctx: TenantContext, item: Item, changes: Item): Item {
  const next: Item = {
    ...item,
    ...changes,
    version: Number(item['version']) + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
  };
  for (const [k, v] of Object.entries(changes))
    if (v === undefined) delete next[k];
  return next;
}

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

async function loadHarvest(ctx: TenantContext, harvestId: string) {
  const h = await getById(harvestId, ctx);
  if (!h || h['entityType'] !== 'TreeHarvest')
    throw notFound('Harvest not found');
  return h;
}

async function loadRound(ctx: TenantContext, roundId: string) {
  const r = await getById(roundId, ctx);
  if (!r || r['entityType'] !== 'PluckingRound')
    throw notFound('Round not found');
  return r;
}

function checkVersion(item: Item, expected: number) {
  if (item['version'] !== expected)
    throw new ApiError(
      'CONFLICT',
      `Record changed (version ${String(item['version'])})`
    );
}

/**
 * Transaction items that book `delta` nuts (HUSKED) to a COMPLETE round's
 * batch and update the round total. Creates the batch when the round had none.
 */
async function stockDelta(
  ctx: TenantContext,
  round: Item,
  delta: number,
  cause: { entityId: string; version: number },
  roundChanges: Item = {}
): Promise<{ items: TxItems; round: Item }> {
  const { tenantId } = ctx.access;
  const TableName = tableName();
  const total = Number(round['totalNuts'] ?? 0) + delta;
  const items: TxItems = [];
  let batchId = round['batchId'] as string | undefined;
  const txnId = txnIds.reconcile(cause.entityId, cause.version);
  const date = ctx.now.slice(0, 10);

  if (delta !== 0 && batchId) {
    const batch = await getById(batchId, ctx);
    if (!batch || batch['entityType'] !== 'ProduceBatch')
      throw notFound('Batch not found');
    const byState = {
      HUSKED: 0,
      DEHUSKED: 0,
      ...(batch['availableByState'] as Item),
    } as Record<'HUSKED' | 'DEHUSKED', number>;
    if (delta < 0 && byState.HUSKED < -delta)
      throw new ApiError(
        'CONFLICT',
        `stock: only ${byState.HUSKED} husked nuts from this round are still in stock`
      );
    const available = Number(batch['available'] ?? 0) + delta;
    items.push(
      versionedPut(
        ctx,
        bump(ctx, batch, {
          quantityReceived: Number(batch['quantityReceived'] ?? 0) + delta,
          available,
          availableByState: { ...byState, HUSKED: byState.HUSKED + delta },
          status: available > 0 ? 'AVAILABLE' : 'DEPLETED',
        }),
        Number(batch['version'])
      )
    );
    items.push({
      Put: {
        TableName,
        Item: {
          ...keys.produceTxn(tenantId, batchId, date, txnId),
          entityType: 'ProduceInventoryTxn',
          id: txnId,
          tenantId,
          farmId: round['farmId'],
          batchId,
          transactionType: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: Math.abs(delta),
          unit: 'NUT',
          state: 'HUSKED',
          transactionDate: date,
          sourceId: cause.entityId,
          reason: 'ROUND_CORRECTION',
          createdAt: ctx.now,
          createdBy: ctx.userId,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
  } else if (delta > 0) {
    // The round had no stock yet (all zeros): open a batch for the difference.
    batchId = ulid();
    const batchDate = String(round['roundDate']);
    items.push(
      {
        Put: {
          TableName,
          Item: {
            ...keys.produceBatch(
              tenantId,
              String(round['farmId']),
              SYSTEM_CROPS.COCONUT.code,
              batchDate,
              batchId
            ),
            ...keys.byId(batchId),
            GSI2SK: 'PRODUCEBATCH',
            entityType: 'ProduceBatch',
            id: batchId,
            tenantId,
            farmId: round['farmId'],
            cropCode: SYSTEM_CROPS.COCONUT.code,
            sourceType: 'PLUCKING_ROUND',
            sourceId: round['id'],
            batchDate,
            quantityReceived: delta,
            unit: 'NUT',
            available: delta,
            availableByState: { HUSKED: delta, DEHUSKED: 0 },
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
            farmId: round['farmId'],
            batchId,
            transactionType: 'ADJUSTMENT_IN',
            quantity: delta,
            unit: 'NUT',
            state: 'HUSKED',
            transactionDate: batchDate,
            sourceId: cause.entityId,
            reason: 'ROUND_CORRECTION',
            createdAt: ctx.now,
            createdBy: ctx.userId,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      }
    );
  }

  const nextRound = bump(ctx, round, {
    totalNuts: total,
    batchId,
    ...roundChanges,
  });
  items.push(versionedPut(ctx, nextRound, Number(round['version'])));
  return { items, round: nextRound };
}

async function commit(items: TxItems, onConflict: () => Promise<Item | null>) {
  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: items }));
    return null;
  } catch (e) {
    if (!(e instanceof TransactionCanceledException)) throw e;
    const replay = await onConflict();
    if (replay) return replay;
    throw new ApiError(
      'CONFLICT',
      'Record changed by someone else; reload and try again'
    );
  }
}

// ─── Harvest correction (#56) ─────────────────────────────────────────────────

export const correctTreeHarvest = tenantOperation({
  name: 'correctTreeHarvest',
  entitlement: 'record.edit',
  input: z.object({
    tenantId: z.string().min(1),
    harvestId: id,
    expectedVersion: z.number().int().positive(),
    quantity: z
      .number()
      .refine(isValidQuantity, 'must be a whole number of nuts (0–500)'),
    recordQuality: z.enum(RECORD_QUALITIES).nullish(),
    notes: z.string().trim().max(1000).nullish(),
    reason,
  }),
  handler: async (input, ctx) => {
    const harvest = await loadHarvest(ctx, input.harvestId);
    if (harvest['deletedAt'])
      throw new ApiError('VALIDATION', 'harvest: restore it before correcting');
    // Idempotent replay: this exact correction already landed.
    if (
      harvest['version'] === input.expectedVersion + 1 &&
      harvest['quantity'] === input.quantity &&
      harvest['updatedBy'] === ctx.userId
    )
      return toView(harvest);
    checkVersion(harvest, input.expectedVersion);

    const before = Number(harvest['quantity'] ?? 0);
    const delta = input.quantity - before;
    const changes: Item = {
      quantity: input.quantity,
      recordQuality: input.recordQuality ?? harvest['recordQuality'],
      notes:
        input.notes === undefined
          ? harvest['notes']
          : (input.notes ?? undefined),
      previousQuantity: before,
    };
    const next = bump(ctx, harvest, changes);
    const items: TxItems = [versionedPut(ctx, next, input.expectedVersion)];

    const round = harvest['roundId']
      ? await loadRound(ctx, String(harvest['roundId']))
      : null;
    if (round && round['status'] === 'COMPLETE' && !round['deletedAt']) {
      const stock = await stockDelta(ctx, round, delta, {
        entityId: input.harvestId,
        version: Number(next['version']),
      });
      items.push(...stock.items);
    }
    items.push(
      audit(ctx, input.harvestId, 'harvest.correct', {
        before: { quantity: before },
        after: { quantity: input.quantity },
        delta,
        reason: input.reason ?? null,
        roundId: harvest['roundId'] ?? null,
      })
    );

    const replay = await commit(items, async () => {
      const latest = await loadHarvest(ctx, input.harvestId);
      return latest['version'] === next['version'] &&
        latest['quantity'] === input.quantity
        ? latest
        : null;
    });
    await refreshTreeSnapshot(ctx, String(harvest['treeId']));
    return toView(replay ?? next);
  },
});

// ─── Harvest soft delete / restore (#57) ──────────────────────────────────────

async function setHarvestDeleted(
  ctx: TenantContext,
  input: {
    harvestId: string;
    expectedVersion: number;
    reason?: string | null | undefined;
  },
  deleted: boolean
) {
  const harvest = await loadHarvest(ctx, input.harvestId);
  const isDeleted = Boolean(harvest['deletedAt']);
  if (isDeleted === deleted) return toView<Item>(harvest); // already done (idempotent)
  checkVersion(harvest, input.expectedVersion);

  const { tenantId } = ctx.access;
  const quantity = Number(harvest['quantity'] ?? 0);
  const next = bump(
    ctx,
    harvest,
    deleted
      ? {
          deletedAt: ctx.now,
          deletedBy: ctx.userId,
          deleteReason: input.reason ?? undefined,
        }
      : {
          deletedAt: undefined,
          deletedBy: undefined,
          deleteReason: undefined,
          restoredAt: ctx.now,
        }
  );
  const items: TxItems = [versionedPut(ctx, next, input.expectedVersion)];
  const round = harvest['roundId']
    ? await loadRound(ctx, String(harvest['roundId']))
    : null;
  if (round?.['deletedAt'])
    throw new ApiError(
      'VALIDATION',
      'round: this harvest belongs to a removed round; restore the round'
    );

  if (round && round['status'] === 'COMPLETE') {
    const stock = await stockDelta(ctx, round, deleted ? -quantity : quantity, {
      entityId: input.harvestId,
      version: Number(next['version']),
    });
    items.push(...stock.items);
  } else if (round) {
    // Open round: free the tree's slot so it can be recorded again, or take it back.
    const slotKey = keys.roundSlot(
      tenantId,
      String(round['id']),
      String(harvest['treeId'])
    );
    if (deleted) {
      items.push({
        Delete: {
          TableName: tableName(),
          Key: slotKey,
          ConditionExpression: 'harvestId = :h',
          ExpressionAttributeValues: { ':h': input.harvestId },
        },
      });
    } else {
      const slot = await getItem(slotKey);
      if (slot)
        throw new ApiError(
          'CONFLICT',
          'tree: already recorded again in this round'
        );
      items.push({
        Put: {
          TableName: tableName(),
          Item: {
            ...slotKey,
            tenantId,
            roundId: round['id'],
            treeId: harvest['treeId'],
            harvestId: input.harvestId,
            harvestDate: harvest['harvestDate'],
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    }
  }
  items.push(
    audit(
      ctx,
      input.harvestId,
      deleted ? 'harvest.archive' : 'harvest.restore',
      {
        quantity,
        reason: input.reason ?? null,
        roundId: harvest['roundId'] ?? null,
      }
    )
  );
  const replay = await commit(items, async () => {
    const latest = await loadHarvest(ctx, input.harvestId);
    return Boolean(latest['deletedAt']) === deleted ? latest : null;
  });
  await refreshTreeSnapshot(ctx, String(harvest['treeId']));
  return toView<Item>(replay ?? next);
}

const harvestDeleteInput = z.object({
  tenantId: z.string().min(1),
  harvestId: id,
  expectedVersion: z.number().int().positive(),
  reason,
});

export const archiveTreeHarvest = tenantOperation({
  name: 'archiveTreeHarvest',
  entitlement: 'record.archive',
  input: harvestDeleteInput,
  handler: (input, ctx) => setHarvestDeleted(ctx, input, true),
});

export const restoreTreeHarvest = tenantOperation({
  name: 'restoreTreeHarvest',
  entitlement: 'record.restore',
  input: harvestDeleteInput,
  handler: (input, ctx) => setHarvestDeleted(ctx, input, false),
});

// ─── Round soft delete / restore (#57) ────────────────────────────────────────

async function roundHarvestItems(ctx: TenantContext, roundId: string) {
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

async function setRoundDeleted(
  ctx: TenantContext,
  input: {
    roundId: string;
    expectedVersion: number;
    reason?: string | null | undefined;
  },
  deleted: boolean
) {
  const round = await loadRound(ctx, input.roundId);
  if (Boolean(round['deletedAt']) === deleted) return toView<Item>(round);
  checkVersion(round, input.expectedVersion);

  const { tenantId } = ctx.access;
  const roundChanges: Item = deleted
    ? {
        deletedAt: ctx.now,
        deletedBy: ctx.userId,
        deleteReason: input.reason ?? undefined,
      }
    : {
        deletedAt: undefined,
        deletedBy: undefined,
        deleteReason: undefined,
        restoredAt: ctx.now,
      };
  const items: TxItems = [];
  let nextRound: Item;

  const batchId = round['batchId'] as string | undefined;
  if (round['status'] === 'COMPLETE' && batchId) {
    const batch = await getById(batchId, ctx);
    if (!batch) throw notFound('Batch not found');
    const received = Number(batch['quantityReceived'] ?? 0);
    const byState = (batch['availableByState'] as Record<string, number>) ?? {};
    if (
      deleted &&
      (Number(batch['available']) !== received ||
        Number(byState['HUSKED'] ?? 0) !== received)
    )
      throw new ApiError(
        'CONFLICT',
        'stock: nuts from this round were already sold, used or dehusked; correct the stock first'
      );
    const qty = deleted ? received : Number(round['totalNuts'] ?? 0);
    nextRound = bump(ctx, round, roundChanges);
    const txnId = txnIds.reconcile(input.roundId, Number(nextRound['version']));
    const date = ctx.now.slice(0, 10);
    items.push(
      versionedPut(
        ctx,
        bump(ctx, batch, {
          available: deleted ? 0 : qty,
          availableByState: { HUSKED: deleted ? 0 : qty, DEHUSKED: 0 },
          quantityReceived: deleted ? received : qty,
          status: deleted ? 'VOID' : 'AVAILABLE',
        }),
        Number(batch['version'])
      ),
      {
        Put: {
          TableName: tableName(),
          Item: {
            ...keys.produceTxn(tenantId, batchId, date, txnId),
            entityType: 'ProduceInventoryTxn',
            id: txnId,
            tenantId,
            farmId: round['farmId'],
            batchId,
            transactionType: deleted ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
            quantity: qty,
            unit: 'NUT',
            state: 'HUSKED',
            transactionDate: date,
            sourceId: input.roundId,
            reason: deleted ? 'ROUND_REMOVED' : 'ROUND_RESTORED',
            createdAt: ctx.now,
            createdBy: ctx.userId,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      }
    );
  } else {
    nextRound = bump(ctx, round, roundChanges);
  }
  items.push(versionedPut(ctx, nextRound, input.expectedVersion));
  items.push(
    audit(ctx, input.roundId, deleted ? 'round.archive' : 'round.restore', {
      totalNuts: round['totalNuts'] ?? null,
      reason: input.reason ?? null,
    })
  );
  const replay = await commit(items, async () => {
    const latest = await loadRound(ctx, input.roundId);
    return Boolean(latest['deletedAt']) === deleted ? latest : null;
  });

  // The round's harvests follow it (excluded from history and prediction, DQ-005).
  // Each is its own versioned write; a re-run finishes any that were missed.
  const harvests = await roundHarvestItems(ctx, input.roundId);
  const trees = new Set<string>();
  for (const h of harvests) {
    const flagged = h['deletedWithRound'] === true;
    if (deleted ? h['deletedAt'] : !flagged) continue;
    const next = bump(
      ctx,
      h,
      deleted
        ? { deletedAt: ctx.now, deletedBy: ctx.userId, deletedWithRound: true }
        : {
            deletedAt: undefined,
            deletedBy: undefined,
            deletedWithRound: undefined,
            restoredAt: ctx.now,
          }
    );
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [versionedPut(ctx, next, Number(h['version']))],
        })
      );
      trees.add(String(h['treeId']));
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
    }
  }
  for (const treeId of trees) await refreshTreeSnapshot(ctx, treeId);
  return toView<Item>(replay ?? nextRound);
}

const roundDeleteInput = z.object({
  tenantId: z.string().min(1),
  roundId: id,
  expectedVersion: z.number().int().positive(),
  reason,
});

export const archivePluckingRound = tenantOperation({
  name: 'archivePluckingRound',
  entitlement: 'record.archive',
  input: roundDeleteInput,
  handler: (input, ctx) => setRoundDeleted(ctx, input, true),
});

export const restorePluckingRound = tenantOperation({
  name: 'restorePluckingRound',
  entitlement: 'record.restore',
  input: roundDeleteInput,
  handler: (input, ctx) => setRoundDeleted(ctx, input, false),
});
