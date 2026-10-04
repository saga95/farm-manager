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
  type ProduceTxnType,
  StockError,
  applyTxn,
} from '../../../../src/domain/inventory';
import { keys } from '../../../../src/domain/keys';
import { type Item, getById } from './crud';
import { tableName } from './db';
import { ApiError, notFound } from './errors';
import type { TenantContext } from './operation';

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
    const stored = (batch['availableByState'] ?? {}) as Partial<
      Record<ProduceState, number>
    >;
    let byState: Record<ProduceState, number> = {
      HUSKED: stored.HUSKED ?? 0,
      DEHUSKED: stored.DEHUSKED ?? 0,
    };
    for (const c of list) {
      const type =
        c.out > 0 ? (c.outType ?? 'SALE_OUT') : (c.inType ?? 'ADJUSTMENT_IN');
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
    const available = byState.HUSKED + byState.DEHUSKED;
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
