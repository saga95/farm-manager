/**
 * Produce inventory (#76–#79, SRS §11, §41.9, §41.10, ADR-0004).
 *
 * Stock is always the sum of transactions. Every write adds ONE transaction
 * with a deterministic id (from the client's operation id) and updates the
 * batch's cached balance in the same DynamoDB transaction, conditioned on the
 * batch version. A retry therefore lands at most once (AC-DH-004), and no
 * movement can take a state below zero (AC-IN-002).
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  MOVEMENT_TYPES,
  PRODUCE_STATES,
  type ProduceState,
  type ProduceTxn,
  StockError,
  applyTxn,
  reasonRequired,
  txnIds,
} from '../../../../src/domain/inventory';
import { isUlid, keys } from '../../../../src/domain/keys';
import { type Item, getById, getItem, queryPrefix, toView } from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { ApiError, notFound } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';

const id = z.string().refine(isUlid, 'must be a ULID');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const quantity = z.number().int().positive().max(1_000_000);

export const listProduceBatches = tenantOperation({
  name: 'listProduceBatches',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    cropCode: z.string().max(40).nullish(),
    availableOnly: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    const prefix = `${keys.prefix.batches}${input.cropCode ? `${input.cropCode}#` : ''}`;
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      prefix
    );
    return items
      .filter(i => i['status'] !== 'VOID')
      .filter(i => !input.availableOnly || Number(i['available']) > 0)
      .sort((a, b) => String(b['SK']).localeCompare(String(a['SK'])))
      .map(i => toView(i));
  },
});

async function loadBatch(ctx: TenantContext, batchId: string) {
  const b = await getById(batchId, ctx);
  if (!b || b['entityType'] !== 'ProduceBatch')
    throw notFound('Batch not found');
  return b;
}

const byStateOf = (batch: Item): Record<ProduceState, number> => {
  const stored = (batch['availableByState'] ?? {}) as Partial<
    Record<ProduceState, number>
  >;
  return { HUSKED: stored.HUSKED ?? 0, DEHUSKED: stored.DEHUSKED ?? 0 };
};

/** Write one txn + the batch's new cached balance atomically; idempotent on txnId. */
async function applyToBatch(
  ctx: TenantContext,
  batchId: string,
  txnId: string,
  txn: ProduceTxn,
  attrs: {
    transactionDate: string;
    notes?: string | null | undefined;
    transactionType: string;
  }
) {
  const { tenantId } = ctx.access;
  const batch = await loadBatch(ctx, batchId);
  if (batch['status'] === 'VOID')
    throw new ApiError('VALIDATION', 'batch: this stock was removed');
  const txnKey = keys.produceTxn(
    tenantId,
    batchId,
    attrs.transactionDate,
    txnId
  );

  // Retry of an operation that already landed (AC-DH-004)
  const existing = await getItem(txnKey);
  if (existing)
    return { batch: toView<Item>(batch), transaction: toView<Item>(existing) };

  let byState: Record<ProduceState, number>;
  try {
    byState = applyTxn(byStateOf(batch), txn);
  } catch (e) {
    if (e instanceof StockError)
      throw new ApiError(
        'VALIDATION',
        `quantity: only ${e.available} ${e.state.toLowerCase()} in stock`
      );
    throw e;
  }
  const available = byState.HUSKED + byState.DEHUSKED;
  const nextBatch: Item = {
    ...batch,
    available,
    availableByState: byState,
    status: available > 0 ? 'AVAILABLE' : 'DEPLETED',
    version: Number(batch['version']) + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
  };
  const txnItem: Item = {
    ...txnKey,
    entityType: 'ProduceInventoryTxn',
    id: txnId,
    tenantId,
    farmId: batch['farmId'],
    batchId,
    transactionType: attrs.transactionType,
    quantity: txn.quantity,
    unit: batch['unit'] ?? 'NUT',
    state: txn.state,
    fromState: txn.fromState,
    toState: txn.toState,
    transactionDate: attrs.transactionDate,
    notes: attrs.notes ?? undefined,
    createdAt: ctx.now,
    createdBy: ctx.userId,
  };
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: nextBatch,
              ConditionExpression: 'version = :v AND tenantId = :t',
              ExpressionAttributeValues: {
                ':v': batch['version'],
                ':t': tenantId,
              },
            },
          },
          {
            Put: {
              TableName: tableName(),
              Item: Object.fromEntries(
                Object.entries(txnItem).filter(([, v]) => v !== undefined)
              ),
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      })
    );
  } catch (e) {
    if (!(e instanceof TransactionCanceledException)) throw e;
    const landed = await getItem(txnKey);
    if (landed)
      return {
        batch: toView<Item>(await loadBatch(ctx, batchId)),
        transaction: toView<Item>(landed),
      };
    throw new ApiError(
      'CONFLICT',
      'Stock changed meanwhile; reload and try again'
    );
  }
  return { batch: toView<Item>(nextBatch), transaction: toView<Item>(txnItem) };
}

export const recordProduceMovement = tenantOperation({
  name: 'recordProduceMovement',
  entitlement: 'inventory.adjust',
  input: z.object({
    tenantId: z.string().min(1),
    batchId: id,
    operationId: id,
    transactionType: z.enum(MOVEMENT_TYPES),
    quantity,
    state: z.enum(PRODUCE_STATES),
    transactionDate: isoDate,
    notes: z.string().trim().max(1000).nullish(),
  }),
  handler: async (input, ctx) => {
    if (reasonRequired(input.transactionType) && !input.notes)
      throw new ApiError(
        'VALIDATION',
        'notes: a reason is required for adjustments'
      );
    return applyToBatch(
      ctx,
      input.batchId,
      txnIds.adjustment(input.operationId),
      {
        type: input.transactionType,
        quantity: input.quantity,
        state: input.state,
      },
      {
        transactionDate: input.transactionDate,
        notes: input.notes,
        transactionType: input.transactionType,
      }
    );
  },
});

export const dehuskProduce = tenantOperation({
  name: 'dehuskProduce',
  entitlement: 'inventory.dehusk',
  input: z.object({
    tenantId: z.string().min(1),
    batchId: id,
    operationId: id,
    quantity,
    transactionDate: isoDate,
    notes: z.string().trim().max(1000).nullish(),
  }),
  handler: (input, ctx) =>
    applyToBatch(
      ctx,
      input.batchId,
      txnIds.dehusk(input.operationId),
      {
        type: 'PROCESSING',
        quantity: input.quantity,
        fromState: 'HUSKED',
        toState: 'DEHUSKED',
      },
      {
        transactionDate: input.transactionDate,
        notes: input.notes,
        transactionType: 'PROCESSING',
      }
    ),
});

const PAGE = 25;

export const getProduceBatch = tenantOperation({
  name: 'getProduceBatch',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    batchId: id,
    limit: z.number().int().min(1).max(100).nullish(),
    nextToken: z.string().max(2000).nullish(),
  }),
  handler: async (input, ctx) => {
    const batch = await loadBatch(ctx, input.batchId);
    let start: Record<string, unknown> | undefined;
    if (input.nextToken) {
      try {
        start = JSON.parse(
          Buffer.from(input.nextToken, 'base64url').toString('utf8')
        ) as Record<string, unknown>;
      } catch {
        throw new ApiError('VALIDATION', 'nextToken: invalid');
      }
      // The token must point inside this batch's partition (no cross-tenant paging)
      const pk = keys.produceTxn(
        ctx.access.tenantId,
        input.batchId,
        '0000-00-00',
        'x'
      ).PK;
      if (start['PK'] !== pk)
        throw new ApiError('VALIDATION', 'nextToken: invalid');
    }
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': keys.produceTxn(
            ctx.access.tenantId,
            input.batchId,
            '0000-00-00',
            'x'
          ).PK,
          ':sk': 'TX#',
        },
        ScanIndexForward: false, // newest first
        Limit: input.limit ?? PAGE,
        ExclusiveStartKey: start,
      })
    );
    return {
      batch: toView(batch),
      transactions: (res.Items ?? []).map(i => toView(i)),
      nextToken: res.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString(
            'base64url'
          )
        : null,
    };
  },
});
