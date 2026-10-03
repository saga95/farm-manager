/**
 * Coconut tree registry (#40–#45, SRS §7.1, FR-CN-001..009, AC-CN-001..003).
 * Trees are keyed by code within the farm, so codes are unique per farm and an
 * archived code can never be silently reused (the record stays).
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  PutCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import {
  INACTIVE_STATUSES,
  MAX_BULK_TREES,
  SYSTEM_CROPS,
  TREE_STATUSES,
  type TreeStatus,
  compareTreeCodes,
  generateTreeCodes,
  isValidTreeCode,
  normalizeTreeCode,
} from '../../../../src/domain/coconut';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  type Item,
  createWithAudit,
  getById,
  queryPrefix,
  requireItem,
  toView,
  updateWithAudit,
} from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { ApiError, notFound } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';

const id = z.string().refine(isUlid, 'must be a ULID');
const text = (max: number) => z.string().trim().max(max).nullish();
const code = z
  .string()
  .transform(normalizeTreeCode)
  .refine(isValidTreeCode, 'letters, digits and hyphens only (max 20)');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .nullish();
const scoped = { tenantId: z.string().min(1), farmId: id };

async function requireFarm(ctx: TenantContext, farmId: string) {
  return requireItem(keys.farm(ctx.access.tenantId, farmId), ctx, 'Farm');
}

async function assertZone(
  ctx: TenantContext,
  farmId: string,
  zoneId: string | null | undefined
) {
  if (!zoneId) return;
  const zone = await requireItem(
    keys.zone(ctx.access.tenantId, farmId, zoneId),
    ctx,
    'Zone'
  );
  if (zone['status'] === 'ARCHIVED')
    throw new ApiError('VALIDATION', 'zoneId: zone is archived');
}

/** Attributes common to every tree record. */
function treeRecord(
  ctx: TenantContext,
  farmId: string,
  treeId: string,
  treeCode: string,
  status: TreeStatus,
  extra: Item
) {
  const tenantId = ctx.access.tenantId;
  return {
    ...keys.tree(tenantId, farmId, treeCode),
    ...keys.treeByStatus(tenantId, farmId, status, treeCode),
    ...keys.byId(treeId),
    GSI2SK: 'TREE',
    entityType: 'Tree',
    id: treeId,
    tenantId,
    farmId,
    code: treeCode,
    cropCode: SYSTEM_CROPS.COCONUT.code,
    status,
    version: 1,
    createdAt: ctx.now,
    createdBy: ctx.userId,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
    ...extra,
  };
}

// ─── Queries ────────────────────────────────────────────────────────────────────

export const listTrees = tenantOperation({
  name: 'listTrees',
  entitlement: 'farm.view',
  input: z.object({ ...scoped, includeInactive: z.boolean().nullish() }),
  handler: async (input, ctx) => {
    await requireFarm(ctx, input.farmId);
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      keys.prefix.trees
    );
    return items
      .filter(
        i =>
          input.includeInactive ||
          !INACTIVE_STATUSES.includes(i['status'] as TreeStatus)
      )
      .sort((a, b) => compareTreeCodes(String(a['code']), String(b['code'])))
      .map(i => toView(i));
  },
});

export const getTree = tenantOperation({
  name: 'getTree',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), treeId: id }),
  handler: async (input, ctx) => {
    const item = await getById(input.treeId, ctx);
    if (!item || item['entityType'] !== 'Tree')
      throw notFound('Tree not found');
    return toView(item);
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────────

const treeFields = {
  displayLabel: text(60),
  zoneId: id.nullish(),
  variety: text(80),
  plantedAt: isoDate,
  locationNote: text(200),
  notes: text(2000),
};

export const createTree = tenantOperation({
  name: 'createTree',
  entitlement: 'tree.manage',
  input: z.object({
    ...scoped,
    treeId: id,
    code,
    status: z.enum(TREE_STATUSES),
    ...treeFields,
  }),
  handler: async (input, ctx) => {
    await requireFarm(ctx, input.farmId);
    await assertZone(ctx, input.farmId, input.zoneId);
    const { tenantId: _t, treeId, code: treeCode, status, ...attrs } = input;
    try {
      const item = await createWithAudit({
        ctx,
        key: keys.tree(ctx.access.tenantId, input.farmId, treeCode),
        id: treeId,
        entityType: 'Tree',
        attributes: {
          ...keys.treeByStatus(
            ctx.access.tenantId,
            input.farmId,
            status,
            treeCode
          ),
          ...attrs,
          code: treeCode,
          cropCode: SYSTEM_CROPS.COCONUT.code,
          status,
        },
        action: 'tree.create',
      });
      return toView(item);
    } catch (e) {
      // FR-CN-004/005: the code exists (possibly archived) → never reuse silently
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        throw new ApiError(
          'CONFLICT',
          `Tree code ${treeCode} is already used on this farm`
        );
      }
      throw e;
    }
  },
});

export const bulkCreateTrees = tenantOperation({
  name: 'bulkCreateTrees',
  entitlement: 'tree.manage',
  input: z.object({
    ...scoped,
    prefix: z
      .string()
      .max(5)
      .default(SYSTEM_CROPS.COCONUT.codePrefix ?? 'C'),
    start: z.number().int().min(0).max(99_999),
    count: z.number().int().min(1).max(MAX_BULK_TREES),
    width: z.number().int().min(1).max(6).nullish(),
    status: z.enum(TREE_STATUSES),
    zoneId: id.nullish(),
  }),
  handler: async (input, ctx) => {
    await requireFarm(ctx, input.farmId);
    await assertZone(ctx, input.farmId, input.zoneId);
    let codes: string[];
    try {
      codes = generateTreeCodes({
        prefix: input.prefix ?? SYSTEM_CROPS.COCONUT.codePrefix ?? 'C',
        start: input.start,
        count: input.count,
        width: input.width ?? 3,
      });
    } catch (e) {
      throw new ApiError('VALIDATION', (e as Error).message);
    }

    const TableName = tableName();
    const tenantId = ctx.access.tenantId;

    // Which codes already exist (AC-CN-002: duplicates reported, not created)
    const existing = new Set<string>();
    for (let i = 0; i < codes.length; i += 100) {
      const chunk = codes.slice(i, i + 100);
      const res = await ddb.send(
        new BatchGetCommand({
          RequestItems: {
            [TableName]: {
              Keys: chunk.map(c => keys.tree(tenantId, input.farmId, c)),
            },
          },
        })
      );
      (res.Responses?.[TableName] ?? []).forEach(item =>
        existing.add(String(item['code']))
      );
    }

    const toCreate = codes.filter(c => !existing.has(c));
    const created: { id: string; code: string }[] = [];
    const skipped = [...existing].sort(compareTreeCodes);
    const extra = { zoneId: input.zoneId ?? undefined };

    const put = (treeCode: string, treeId: string) => ({
      Put: {
        TableName,
        Item: treeRecord(
          ctx,
          input.farmId,
          treeId,
          treeCode,
          input.status,
          extra
        ),
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });

    for (let i = 0; i < toCreate.length; i += 25) {
      const chunk = toCreate
        .slice(i, i + 25)
        .map(c => ({ code: c, id: ulid() }));
      try {
        await ddb.send(
          new TransactWriteCommand({
            TransactItems: chunk.map(t => put(t.code, t.id)),
          })
        );
        created.push(...chunk);
      } catch (e) {
        if (!(e instanceof TransactionCanceledException)) throw e;
        // A concurrent writer took some codes: fall back to one-by-one
        for (const t of chunk) {
          try {
            await ddb.send(
              new TransactWriteCommand({ TransactItems: [put(t.code, t.id)] })
            );
            created.push(t);
          } catch (err) {
            if (!(err instanceof TransactionCanceledException)) throw err;
            skipped.push(t.code);
          }
        }
      }
    }

    if (created.length > 0) {
      // One summary audit entry per bulk run; each tree also carries createdBy/createdAt.
      await ddb.send(
        new PutCommand({
          TableName,
          Item: {
            ...keys.audit(tenantId, input.farmId, ctx.now, ulid()),
            entityType: 'AuditLog',
            tenantId,
            at: ctx.now,
            actorId: ctx.userId,
            action: 'tree.bulkCreate',
            entityId: input.farmId,
            details: {
              count: created.length,
              first: created[0]?.code,
              last: created.at(-1)?.code,
              skipped,
            },
          },
        })
      );
    }

    return { created, skipped: skipped.sort(compareTreeCodes) };
  },
});

export const updateTree = tenantOperation({
  name: 'updateTree',
  entitlement: 'tree.manage',
  input: z.object({
    ...scoped,
    code,
    expectedVersion: z.number().int().positive(),
    status: z.enum(TREE_STATUSES).nullish(),
    ...treeFields,
  }),
  handler: async (input, ctx) => {
    const {
      tenantId: _t,
      farmId,
      code: treeCode,
      expectedVersion,
      ...changes
    } = input;
    await assertZone(ctx, farmId, changes.zoneId);
    const statusKeys = changes.status
      ? keys.treeByStatus(ctx.access.tenantId, farmId, changes.status, treeCode)
      : {};
    const updated = await updateWithAudit({
      ctx,
      key: keys.tree(ctx.access.tenantId, farmId, treeCode),
      expectedVersion,
      // `code` is immutable once tagged (§7.1): it is the key, never an updatable field
      changes: { ...changes, ...statusKeys },
      action: 'tree.update',
    });
    return toView(updated);
  },
});
