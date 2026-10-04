/**
 * Farm-input inventory (#80, #81, SRS §12, AC-IN-005).
 *
 * Items keep a cached `quantity` that is updated in the SAME transaction as
 * every movement (version-conditioned), so it always equals the sum of the
 * item's transactions. Movement ids are deterministic from the client's
 * operation id: a retry lands at most once (ADR-0004). Separate from produce
 * stock: nothing here touches ProduceBatch.
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  INPUT_CATEGORIES,
  INPUT_STATUSES,
  INPUT_TXN_TYPES,
  INPUT_UNITS,
  InputStockError,
  applyInputTxn,
  inputReasonRequired,
  isLowStock,
  roundQty,
} from '../../../../src/domain/inputs';
import { isUlid, keys } from '../../../../src/domain/keys';
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
import { ApiError, notFound } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';

const id = z.string().refine(isUlid, 'must be a ULID');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const amount = z.number().positive().max(1_000_000);
const name = z.string().trim().min(1).max(120);
const level = z.number().min(0).max(1_000_000).nullish();
const notes = z.string().trim().max(1000).nullish();

const view = (item: Item) => {
  const v = toView<Item>(item);
  return {
    ...v,
    lowStock: isLowStock(
      Number(item['quantity'] ?? 0),
      item['reorderLevel'] as number | null
    ),
  };
};

async function loadItem(ctx: TenantContext, itemId: string) {
  const item = await getById(itemId, ctx);
  if (!item || item['entityType'] !== 'InputItem')
    throw notFound('Item not found');
  return item;
}

function txnItem(
  ctx: TenantContext,
  item: Item,
  txnId: string,
  t: {
    type: string;
    quantity: number;
    date: string;
    reason?: string | null;
    notes?: string | null;
    balanceAfter: number;
  }
): Item {
  const out: Item = {
    ...keys.inputTxn(ctx.access.tenantId, String(item['id']), t.date, txnId),
    entityType: 'InputTxn',
    id: txnId,
    tenantId: ctx.access.tenantId,
    farmId: item['farmId'],
    itemId: item['id'],
    transactionType: t.type,
    quantity: t.quantity,
    unit: item['unit'],
    transactionDate: t.date,
    balanceAfter: t.balanceAfter,
    reason: t.reason ?? undefined,
    notes: t.notes ?? undefined,
    createdAt: ctx.now,
    createdBy: ctx.userId,
  };
  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined)
  );
}

export const createInputItem = tenantOperation({
  name: 'createInputItem',
  entitlement: 'input.manage',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    itemId: id,
    name,
    category: z.enum(INPUT_CATEGORIES),
    unit: z.enum(INPUT_UNITS),
    reorderLevel: level,
    notes,
    openingQuantity: z.number().min(0).max(1_000_000).nullish(),
    openingDate: isoDate.nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    await requireItem(keys.farm(tenantId, input.farmId), ctx, 'Farm');
    const key = keys.inputItem(tenantId, input.farmId, input.itemId);
    const existing = await getItem(key);
    if (existing) {
      if (existing['createdBy'] === ctx.userId) return view(existing); // idempotent replay
      throw new ApiError('CONFLICT', 'Id already in use');
    }
    const opening = roundQty(input.openingQuantity ?? 0);
    const item: Item = {
      ...key,
      ...keys.byId(input.itemId),
      GSI2SK: 'INPUTITEM',
      entityType: 'InputItem',
      id: input.itemId,
      tenantId,
      farmId: input.farmId,
      name: input.name,
      category: input.category,
      unit: input.unit,
      reorderLevel: input.reorderLevel ?? undefined,
      notes: input.notes ?? undefined,
      quantity: opening,
      status: 'ACTIVE',
      version: 1,
      createdAt: ctx.now,
      createdBy: ctx.userId,
      updatedAt: ctx.now,
      updatedBy: ctx.userId,
    };
    const clean = Object.fromEntries(
      Object.entries(item).filter(([, v]) => v !== undefined)
    );
    const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [
      {
        Put: {
          TableName: tableName(),
          Item: clean,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ];
    if (opening > 0) {
      items.push({
        Put: {
          TableName: tableName(),
          Item: txnItem(ctx, clean, `OPEN#${input.itemId}`, {
            type: 'STOCK_IN',
            quantity: opening,
            date: input.openingDate ?? ctx.now.slice(0, 10),
            notes: 'Opening stock',
            balanceAfter: opening,
          }),
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    }
    try {
      await ddb.send(new TransactWriteCommand({ TransactItems: items }));
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      const again = await getItem(key);
      if (again && again['createdBy'] === ctx.userId) return view(again);
      throw new ApiError('CONFLICT', 'Id already in use');
    }
    return view(clean);
  },
});

export const updateInputItem = tenantOperation({
  name: 'updateInputItem',
  entitlement: 'input.manage',
  input: z.object({
    tenantId: z.string().min(1),
    itemId: id,
    expectedVersion: z.number().int().positive(),
    name: name.nullish(),
    category: z.enum(INPUT_CATEGORIES).nullish(),
    reorderLevel: level,
    clearReorderLevel: z.boolean().nullish(),
    notes,
    status: z.enum(INPUT_STATUSES).nullish(),
  }),
  handler: async (input, ctx) => {
    const item = await loadItem(ctx, input.itemId);
    const updated = await updateWithAudit({
      ctx,
      key: { PK: String(item['PK']), SK: String(item['SK']) },
      expectedVersion: input.expectedVersion,
      changes: {
        name: input.name ?? undefined,
        category: input.category ?? undefined,
        reorderLevel: input.clearReorderLevel
          ? null
          : (input.reorderLevel ?? undefined),
        notes: input.notes ?? undefined,
        status: input.status ?? undefined,
      },
      action: 'input.update',
    });
    return view(updated);
  },
});

export const listInputItems = tenantOperation({
  name: 'listInputItems',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    includeArchived: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      keys.prefix.inputs
    );
    return items
      .filter(i => input.includeArchived || i['status'] !== 'ARCHIVED')
      .sort((a, b) => String(a['name']).localeCompare(String(b['name'])))
      .map(view);
  },
});

/**
 * Transaction items for one movement on a farm-input item: the item's new
 * cached quantity (version-conditioned) + the movement (deterministic id).
 * Shared with farm activities that use an input (#94).
 */
export function inputMovementWrites(
  ctx: TenantContext,
  item: Item,
  txnId: string,
  t: {
    type: (typeof INPUT_TXN_TYPES)[number];
    quantity: number;
    date: string;
    reason?: string | null | undefined;
    notes?: string | null | undefined;
  }
) {
  let next: number;
  try {
    next = applyInputTxn(Number(item['quantity'] ?? 0), {
      type: t.type,
      quantity: t.quantity,
    });
  } catch (e) {
    if (e instanceof InputStockError)
      throw new ApiError(
        'VALIDATION',
        `quantity: only ${e.available} ${String(item['unit']).toLowerCase()} of ${String(item['name'])} in stock`
      );
    throw e;
  }
  const nextItem: Item = {
    ...item,
    quantity: next,
    version: Number(item['version']) + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
  };
  const txn = txnItem(ctx, item, txnId, {
    type: t.type,
    quantity: t.quantity,
    date: t.date,
    reason: t.reason ?? null,
    notes: t.notes ?? null,
    balanceAfter: next,
  });
  const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    {
      Put: {
        TableName: tableName(),
        Item: nextItem,
        ConditionExpression: 'version = :v AND tenantId = :t',
        ExpressionAttributeValues: {
          ':v': item['version'],
          ':t': ctx.access.tenantId,
        },
      },
    },
    {
      Put: {
        TableName: tableName(),
        Item: txn,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
  ];
  return { nextItem, txn, items };
}

export async function loadInputItem(ctx: TenantContext, itemId: string) {
  return loadItem(ctx, itemId);
}

export const recordInputMovement = tenantOperation({
  name: 'recordInputMovement',
  entitlement: 'input.manage',
  input: z.object({
    tenantId: z.string().min(1),
    itemId: id,
    operationId: id,
    transactionType: z.enum(INPUT_TXN_TYPES),
    /** Positive; for ADJUSTMENT pass `decrease: true` to take stock away */
    quantity: amount,
    decrease: z.boolean().nullish(),
    transactionDate: isoDate,
    reason: z.string().trim().max(500).nullish(),
    notes,
  }),
  handler: async (input, ctx) => {
    if (inputReasonRequired(input.transactionType) && !input.reason)
      throw new ApiError(
        'VALIDATION',
        'reason: a reason is required for adjustments'
      );
    const { tenantId } = ctx.access;
    const item = await loadItem(ctx, input.itemId);
    if (item['status'] === 'ARCHIVED')
      throw new ApiError('VALIDATION', 'item: archived items cannot change');
    const txnId = `MV#${input.operationId}`;
    const txnKey = keys.inputTxn(
      tenantId,
      input.itemId,
      input.transactionDate,
      txnId
    );
    const landed = await getItem(txnKey);
    if (landed) return { item: view(item), transaction: toView(landed) }; // retry

    const signed =
      input.transactionType === 'ADJUSTMENT' && input.decrease
        ? -input.quantity
        : input.quantity;
    const { nextItem, txn, items } = inputMovementWrites(ctx, item, txnId, {
      type: input.transactionType,
      quantity: signed,
      date: input.transactionDate,
      reason: input.reason,
      notes: input.notes,
    });
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: items,
        })
      );
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      const again = await getItem(txnKey);
      if (again)
        return {
          item: view(await loadItem(ctx, input.itemId)),
          transaction: toView(again),
        };
      throw new ApiError(
        'CONFLICT',
        'Stock changed meanwhile; reload and try again'
      );
    }
    return { item: view(nextItem), transaction: toView(txn) };
  },
});

export const getInputItem = tenantOperation({
  name: 'getInputItem',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    itemId: id,
    limit: z.number().int().min(1).max(100).nullish(),
    nextToken: z.string().max(2000).nullish(),
  }),
  handler: async (input, ctx) => {
    const item = await loadItem(ctx, input.itemId);
    const pk = keys.inputTxnPk(ctx.access.tenantId, input.itemId);
    let start: Record<string, unknown> | undefined;
    if (input.nextToken) {
      try {
        start = JSON.parse(
          Buffer.from(input.nextToken, 'base64url').toString('utf8')
        ) as Record<string, unknown>;
      } catch {
        throw new ApiError('VALIDATION', 'nextToken: invalid');
      }
      if (start['PK'] !== pk)
        throw new ApiError('VALIDATION', 'nextToken: invalid');
    }
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': pk, ':sk': 'TX#' },
        ScanIndexForward: false,
        Limit: input.limit ?? 25,
        ExclusiveStartKey: start,
      })
    );
    return {
      item: view(item),
      transactions: (res.Items ?? []).map(i => toView(i)),
      nextToken: res.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString(
            'base64url'
          )
        : null,
    };
  },
});
