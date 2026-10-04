/**
 * Sales (#85–#89, SRS §13.3–13.5, AC-SL-002..006, AC-DH-003, CALC-011..013).
 *
 * Recording a sale completes it: size/price lines, the calculated amount
 * (Σ lines) and the actual amount received are stored side by side (DQ-009),
 * and the nuts leave stock from the chosen batches/states as SALE_OUT
 * transactions in the SAME DynamoDB transaction. Transaction ids are
 * deterministic per sale + batch + state, so a retried save can never take
 * stock twice (AC-SL-006). Overselling is refused (§13.5).
 *
 * Editing reconciles stock by the per batch+state difference; removing a sale
 * returns its nuts; restoring takes them again. All audited (§31).
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import { PRODUCE_STATES, txnIds } from '../../../../src/domain/inventory';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  type Allocation,
  allocationDelta,
  lineAmount,
  mergeAllocations,
  saleTotals,
  validateSale,
} from '../../../../src/domain/sales';
import { SIZE_CLASSES } from '../../../../src/domain/samples';
import { type Item, getById, getItem, requireItem, toView } from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { ApiError, notFound } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';
import { type StockChange, type TxItems, stockWrites } from '../lib/stock';

const id = z.string().refine(isUlid, 'must be a ULID');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const money = z.number().min(0).max(100_000_000);

const lineSchema = z.object({
  sizeClass: z.enum(SIZE_CLASSES).nullish(),
  quantity: z.number().int().positive().max(100_000),
  unitPrice: money,
});
const allocationSchema = z.object({
  batchId: id,
  state: z.enum(PRODUCE_STATES),
  quantity: z.number().int().positive().max(100_000),
});
/** AWSJSON arguments may arrive as a JSON string or already parsed. */
const parseJson = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return v;
  }
};
const linesSchema = z.array(lineSchema).min(1).max(50);
const allocationsSchema = z.array(allocationSchema).min(1).max(20);

const saleFields = {
  buyerId: id.nullish(),
  lines: z.preprocess(parseJson, linesSchema) as unknown as typeof linesSchema,
  allocations: z.preprocess(
    parseJson,
    allocationsSchema
  ) as unknown as typeof allocationsSchema,
  actualAmountReceived: money.nullish(),
  differenceReason: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(1000).nullish(),
};

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

function checkSale(
  lines: z.infer<typeof lineSchema>[],
  allocations: Allocation[]
) {
  const problem = validateSale(lines, allocations);
  if (problem?.code === 'NO_LINES')
    throw new ApiError('VALIDATION', 'lines: add at least one line');
  if (problem?.code === 'ALLOCATION_MISMATCH')
    throw new ApiError(
      'VALIDATION',
      `allocations: ${problem.sold} nuts sold but ${problem.allocated} taken from stock`
    );
}

async function buyerSnapshot(ctx: TenantContext, buyerId?: string | null) {
  if (!buyerId) return { buyerId: undefined, buyerName: undefined };
  const b = await getById(buyerId, ctx);
  if (!b || b['entityType'] !== 'Buyer') throw notFound('Buyer not found');
  return { buyerId, buyerName: String(b['name']) };
}

/** Lines with derived amounts + totals (CALC-011..013). */
function amounts(lines: z.infer<typeof lineSchema>[], actual?: number | null) {
  return {
    lines: lines.map(l => ({
      sizeClass: l.sizeClass ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineAmount: lineAmount(l),
    })),
    ...saleTotals(lines, actual),
  };
}

async function loadSale(ctx: TenantContext, saleId: string) {
  const s = await getById(saleId, ctx);
  if (!s || s['entityType'] !== 'Sale') throw notFound('Sale not found');
  return s;
}

async function commit(
  items: TxItems,
  onConflict: () => Promise<Item | null>
): Promise<Item | null> {
  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: items }));
    return null;
  } catch (e) {
    if (!(e instanceof TransactionCanceledException)) throw e;
    const replay = await onConflict();
    if (replay) return replay;
    throw new ApiError(
      'CONFLICT',
      'Stock or sale changed meanwhile; reload and try again'
    );
  }
}

// ─── Record (= complete) a sale (#85–#87) ─────────────────────────────────────

export const recordSale = tenantOperation({
  name: 'recordSale',
  entitlement: 'sale.record',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    saleId: id,
    saleDate: isoDate,
    currency: z.string().length(3).nullish(),
    ...saleFields,
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const farm = await requireItem(
      keys.farm(tenantId, input.farmId),
      ctx,
      'Farm'
    );
    const key = keys.sale(tenantId, input.farmId, input.saleDate, input.saleId);
    const existing = await getItem(key);
    if (existing) {
      if (existing['createdBy'] === ctx.userId) return toView(existing); // retry (AC-SL-006)
      throw new ApiError('CONFLICT', 'Id already in use');
    }
    const allocations = mergeAllocations(input.allocations);
    checkSale(input.lines, allocations);
    const buyer = await buyerSnapshot(ctx, input.buyerId);
    const tenant = await getItem(keys.tenant(tenantId));

    const sale: Item = {
      ...key,
      ...keys.byId(input.saleId),
      ...(buyer.buyerId
        ? keys.saleByBuyer(
            tenantId,
            buyer.buyerId,
            input.saleDate,
            input.saleId
          )
        : {}),
      GSI2SK: 'SALE',
      entityType: 'Sale',
      id: input.saleId,
      tenantId,
      farmId: input.farmId,
      saleDate: input.saleDate,
      ...buyer,
      cropCode: 'COCONUT',
      quantityUnit: 'NUT',
      ...amounts(input.lines, input.actualAmountReceived),
      allocations,
      differenceReason: input.differenceReason ?? undefined,
      notes: input.notes ?? undefined,
      currency:
        input.currency ??
        tenant?.['defaultCurrency'] ??
        farm['currency'] ??
        'LKR',
      photoIds: [],
      status: 'COMPLETE',
      version: 1,
      createdAt: ctx.now,
      createdBy: ctx.userId,
      updatedAt: ctx.now,
      updatedBy: ctx.userId,
    };
    const clean = Object.fromEntries(
      Object.entries(sale).filter(([, v]) => v !== undefined)
    );
    const stock = await stockWrites(
      ctx,
      input.farmId,
      input.saleDate,
      allocations.map(
        (a): StockChange => ({
          batchId: a.batchId,
          state: a.state,
          out: a.quantity,
          txnId: txnIds.saleOut(input.saleId, a.batchId, a.state),
          sourceId: input.saleId,
        })
      )
    );
    const items: TxItems = [
      {
        Put: {
          TableName: tableName(),
          Item: clean,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      ...stock,
      audit(ctx, input.saleId, 'sale.record', {
        totalQuantity: clean['totalQuantity'],
        calculatedAmount: clean['calculatedAmount'],
        actualAmountReceived: clean['actualAmountReceived'] ?? null,
      }),
    ];
    const replay = await commit(items, async () => {
      const again = await getItem(key);
      return again && again['createdBy'] === ctx.userId ? again : null;
    });
    return toView(replay ?? clean);
  },
});

// ─── Edit a completed sale with reconciliation (#88) ──────────────────────────

export const updateSale = tenantOperation({
  name: 'updateSale',
  entitlement: 'record.edit',
  input: z.object({
    tenantId: z.string().min(1),
    saleId: id,
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().max(500).nullish(),
    ...saleFields,
  }),
  handler: async (input, ctx) => {
    const sale = await loadSale(ctx, input.saleId);
    if (sale['deletedAt'])
      throw new ApiError('VALIDATION', 'sale: restore it before editing');
    if (
      sale['version'] === input.expectedVersion + 1 &&
      sale['updatedBy'] === ctx.userId
    )
      return toView(sale); // retry of this edit
    if (sale['version'] !== input.expectedVersion)
      throw new ApiError(
        'CONFLICT',
        `Record changed (version ${String(sale['version'])})`
      );

    const allocations = mergeAllocations(input.allocations);
    checkSale(input.lines, allocations);
    const buyer = await buyerSnapshot(ctx, input.buyerId);
    const { tenantId } = ctx.access;
    const saleDate = String(sale['saleDate']);
    const nextVersion = input.expectedVersion + 1;
    const delta = allocationDelta(
      (sale['allocations'] as Allocation[]) ?? [],
      allocations
    );

    const next: Item = {
      ...sale,
      ...amounts(input.lines, input.actualAmountReceived),
      allocations,
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      differenceReason: input.differenceReason ?? undefined,
      notes: input.notes ?? undefined,
      version: nextVersion,
      updatedAt: ctx.now,
      updatedBy: ctx.userId,
    };
    delete next['GSI1PK'];
    delete next['GSI1SK'];
    if (buyer.buyerId)
      Object.assign(
        next,
        keys.saleByBuyer(tenantId, buyer.buyerId, saleDate, input.saleId)
      );
    const clean = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined)
    );

    const stock = await stockWrites(
      ctx,
      String(sale['farmId']),
      ctx.now.slice(0, 10),
      delta.map(
        (d): StockChange => ({
          batchId: d.batchId,
          state: d.state,
          out: d.quantity,
          txnId: `${txnIds.reconcile(input.saleId, nextVersion)}#${d.batchId}#${d.state}`,
          reason: 'SALE_CORRECTION',
          sourceId: input.saleId,
        })
      )
    );
    const items: TxItems = [
      {
        Put: {
          TableName: tableName(),
          Item: clean,
          ConditionExpression: 'version = :v AND tenantId = :t',
          ExpressionAttributeValues: {
            ':v': input.expectedVersion,
            ':t': tenantId,
          },
        },
      },
      ...stock,
      audit(ctx, input.saleId, 'sale.update', {
        before: {
          totalQuantity: sale['totalQuantity'],
          calculatedAmount: sale['calculatedAmount'],
          actualAmountReceived: sale['actualAmountReceived'] ?? null,
        },
        after: {
          totalQuantity: clean['totalQuantity'],
          calculatedAmount: clean['calculatedAmount'],
          actualAmountReceived: clean['actualAmountReceived'] ?? null,
        },
        stockDelta: delta,
        reason: input.reason ?? null,
      }),
    ];
    const replay = await commit(items, async () => {
      const latest = await loadSale(ctx, input.saleId);
      return latest['version'] === nextVersion &&
        latest['updatedBy'] === ctx.userId
        ? latest
        : null;
    });
    return toView(replay ?? clean);
  },
});

// ─── Remove / restore a sale (#88, §31) ───────────────────────────────────────

async function setSaleDeleted(
  ctx: TenantContext,
  input: {
    saleId: string;
    expectedVersion: number;
    reason?: string | null | undefined;
  },
  deleted: boolean
) {
  const sale = await loadSale(ctx, input.saleId);
  if (Boolean(sale['deletedAt']) === deleted) return toView(sale);
  if (sale['version'] !== input.expectedVersion)
    throw new ApiError(
      'CONFLICT',
      `Record changed (version ${String(sale['version'])})`
    );
  const nextVersion = input.expectedVersion + 1;
  const next: Item = {
    ...sale,
    version: nextVersion,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
  };
  if (deleted)
    Object.assign(next, {
      deletedAt: ctx.now,
      deletedBy: ctx.userId,
      deleteReason: input.reason ?? null,
    });
  else {
    delete next['deletedAt'];
    delete next['deletedBy'];
    delete next['deleteReason'];
    next['restoredAt'] = ctx.now;
  }
  const stock = await stockWrites(
    ctx,
    String(sale['farmId']),
    ctx.now.slice(0, 10),
    ((sale['allocations'] as Allocation[]) ?? []).map(
      (a): StockChange => ({
        batchId: a.batchId,
        state: a.state,
        out: deleted ? -a.quantity : a.quantity,
        txnId: `${txnIds.reconcile(input.saleId, nextVersion)}#${a.batchId}#${a.state}`,
        reason: deleted ? 'SALE_REMOVED' : 'SALE_RESTORED',
        sourceId: input.saleId,
      })
    )
  );
  const items: TxItems = [
    {
      Put: {
        TableName: tableName(),
        Item: next,
        ConditionExpression: 'version = :v AND tenantId = :t',
        ExpressionAttributeValues: {
          ':v': input.expectedVersion,
          ':t': ctx.access.tenantId,
        },
      },
    },
    ...stock,
    audit(ctx, input.saleId, deleted ? 'sale.archive' : 'sale.restore', {
      reason: input.reason ?? null,
    }),
  ];
  const replay = await commit(items, async () => {
    const latest = await loadSale(ctx, input.saleId);
    return Boolean(latest['deletedAt']) === deleted ? latest : null;
  });
  return toView(replay ?? next);
}

const deleteInput = z.object({
  tenantId: z.string().min(1),
  saleId: id,
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(500).nullish(),
});

export const archiveSale = tenantOperation({
  name: 'archiveSale',
  entitlement: 'record.archive',
  input: deleteInput,
  handler: (input, ctx) => setSaleDeleted(ctx, input, true),
});

export const restoreSale = tenantOperation({
  name: 'restoreSale',
  entitlement: 'record.restore',
  input: deleteInput,
  handler: (input, ctx) => setSaleDeleted(ctx, input, false),
});

// ─── Read (#89) ───────────────────────────────────────────────────────────────

export const getSale = tenantOperation({
  name: 'getSale',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), saleId: id }),
  handler: async (input, ctx) => toView(await loadSale(ctx, input.saleId)),
});

/** History newest first; filter by buyer and/or date range; paginated. */
export const listSales = tenantOperation({
  name: 'listSales',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    buyerId: id.nullish(),
    from: isoDate.nullish(),
    to: isoDate.nullish(),
    includeDeleted: z.boolean().nullish(),
    limit: z.number().int().min(1).max(100).nullish(),
    nextToken: z.string().max(2000).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const byBuyer = Boolean(input.buyerId);
    const pk = byBuyer
      ? keys.saleByBuyer(tenantId, input.buyerId as string, '0000-00-00', 'x')
          .GSI1PK
      : keys.farmPk(tenantId, input.farmId);
    const pkAttr = byBuyer ? 'GSI1PK' : 'PK';
    const skAttr = byBuyer ? 'GSI1SK' : 'SK';
    let start: Record<string, unknown> | undefined;
    if (input.nextToken) {
      try {
        start = JSON.parse(
          Buffer.from(input.nextToken, 'base64url').toString('utf8')
        ) as Record<string, unknown>;
      } catch {
        throw new ApiError('VALIDATION', 'nextToken: invalid');
      }
      if (start[pkAttr] !== pk)
        throw new ApiError('VALIDATION', 'nextToken: invalid');
    }
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        ...(byBuyer ? { IndexName: 'GSI1' } : {}),
        KeyConditionExpression: `${pkAttr} = :pk AND ${skAttr} BETWEEN :a AND :b`,
        ExpressionAttributeValues: {
          ':pk': pk,
          ':a': `SALE#${input.from ?? '0000-00-00'}`,
          ':b': `SALE#${input.to ?? '9999-12-31'}#~`,
        },
        ScanIndexForward: false,
        Limit: input.limit ?? 25,
        ExclusiveStartKey: start,
      })
    );
    const items = (res.Items ?? []).filter(
      i =>
        i['tenantId'] === tenantId &&
        i['entityType'] === 'Sale' &&
        i['farmId'] === input.farmId &&
        (input.includeDeleted || !i['deletedAt'])
    );
    return {
      sales: items.map(i => toView(i)),
      nextToken: res.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString(
            'base64url'
          )
        : null,
    };
  },
});
