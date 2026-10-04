/**
 * Produce stock writes shared by cause-specific operations (sales, sale edits,
 * sale removal). Turns per batch+state changes into DynamoDB transaction items:
 * one version-conditioned Put per batch (new cached balance) + one Put per
 * transaction with a caller-supplied deterministic id (ADR-0004). Never lets a
 * state go below zero (AC-IN-002).
 */

import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import {
  type ProduceState,
  type ProduceTxn,
  type ProduceTxnType,
  type StockByState,
  StockError,
  applyTxn,
  statesFor,
  stockOf,
  stockTotal,
} from '../../../../src/domain/inventory';
import { keys } from '../../../../src/domain/keys';
import { type Item, getById } from './crud';
import { tableName } from './db';
import { ApiError, notFound } from './errors';
import type { TenantContext } from './operation';

/** The movement must fit this batch: its states, and whole nuts for coconut. */
export function checkBatchTxn(batch: Item, txn: ProduceTxn) {
  const crop = String(batch['cropCode'] ?? 'COCONUT');
  const states = statesFor(crop);
  if (txn.type === 'PROCESSING' && crop !== 'COCONUT')
    throw new ApiError('VALIDATION', 'batch: only coconuts are dehusked');
  for (const s of [txn.state, txn.fromState, txn.toState])
    if (s && !states.includes(s))
      throw new ApiError(
        'VALIDATION',
        `state: this stock has no ${s.toLowerCase()} state`
      );
  if ((batch['unit'] ?? 'NUT') === 'NUT' && !Number.isInteger(txn.quantity))
    throw new ApiError('VALIDATION', 'quantity: whole nuts only');
}

export type TxItems = NonNullable<TransactWriteCommandInput['TransactItems']>;

export interface StockChange {
  batchId: string;
  state: ProduceState;
  /** Positive: nuts leave stock. Negative: nuts come back. */
  out: number;
  txnId: string;
  /** Type for nuts leaving (default SALE_OUT) */
  outType?: ProduceTxnType;
  /** Type for nuts coming back (default ADJUSTMENT_IN) */
  inType?: ProduceTxnType;
  reason?: string;
  sourceId: string;
}

export async function stockWrites(
  ctx: TenantContext,
  farmId: string,
  date: string,
  changes: readonly StockChange[]
): Promise<TxItems> {
  const { tenantId } = ctx.access;
  const items: TxItems = [];
  const byBatch = new Map<string, StockChange[]>();
  for (const c of changes) {
    if (c.out === 0) continue;
    byBatch.set(c.batchId, [...(byBatch.get(c.batchId) ?? []), c]);
  }
  for (const [batchId, list] of byBatch) {
    const batch = await getById(batchId, ctx);
    if (
      !batch ||
      batch['entityType'] !== 'ProduceBatch' ||
      batch['farmId'] !== farmId
    )
      throw notFound('Stock batch not found');
    if (batch['status'] === 'VOID')
      throw new ApiError('VALIDATION', 'batch: this stock was removed');
    let byState: StockByState = stockOf(
      String(batch['cropCode'] ?? 'COCONUT'),
      batch['availableByState'] as StockByState
    );
    for (const c of list) {
      const type =
        c.out > 0 ? (c.outType ?? 'SALE_OUT') : (c.inType ?? 'ADJUSTMENT_IN');
      checkBatchTxn(batch, { type, quantity: Math.abs(c.out), state: c.state });
      try {
        byState = applyTxn(byState, {
          type,
          quantity: Math.abs(c.out),
          state: c.state,
        });
      } catch (e) {
        if (e instanceof StockError)
          throw new ApiError(
            'VALIDATION',
            `allocations: only ${e.available} ${e.state.toLowerCase()} left in the ${String(batch['batchDate'])} stock`
          );
        throw e;
      }
      const txn: Item = {
        ...keys.produceTxn(tenantId, batchId, date, c.txnId),
        entityType: 'ProduceInventoryTxn',
        id: c.txnId,
        tenantId,
        farmId,
        batchId,
        transactionType: type,
        quantity: Math.abs(c.out),
        unit: batch['unit'] ?? 'NUT',
        state: c.state,
        transactionDate: date,
        sourceId: c.sourceId,
        createdAt: ctx.now,
        createdBy: ctx.userId,
      };
      if (c.reason) txn['reason'] = c.reason;
      items.push({
        Put: {
          TableName: tableName(),
          Item: txn,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    }
    const available = stockTotal(byState);
    items.push({
      Put: {
        TableName: tableName(),
        Item: {
          ...batch,
          available,
          availableByState: byState,
          status: available > 0 ? 'AVAILABLE' : 'DEPLETED',
          version: Number(batch['version']) + 1,
          updatedAt: ctx.now,
          updatedBy: ctx.userId,
        },
        ConditionExpression: 'version = :v AND tenantId = :t',
        ExpressionAttributeValues: { ':v': batch['version'], ':t': tenantId },
      },
    });
  }
  return items;
}
