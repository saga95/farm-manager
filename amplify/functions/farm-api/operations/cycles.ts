/**
 * Production cycles and farm activities (#91–#94, SRS §6.3, §14, §41.3–41.4).
 *
 * - A cycle is one planting of a crop in a zone, optionally in a bed / grow-bag
 *   area (GrowingSpace). Plants are a COUNT on the cycle, never records
 *   (AC-PC-001). Status moves through PLANNED → ACTIVE → HARVESTING →
 *   COMPLETED (or CANCELLED); completing keeps all history (AC-PC-004).
 * - Activities (watering, fertiliser, weeding…) attach to a cycle, a growing
 *   space or a zone (AC-MA-001, AC-PC-002). An activity may use a farm input:
 *   the input's stock goes down in the SAME transaction, with a deterministic
 *   movement id, so a retried save deducts once.
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  ACTIVITY_TYPES,
  type CycleStatus,
  canMoveCycle,
  cropCodeOf,
  isOpenCycle,
} from '../../../../src/domain/cycles';
import { AREA_UNITS } from '../../../../src/domain/farm';
import { isUlid, keys } from '../../../../src/domain/keys';
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
import { inputMovementWrites, loadInputItem } from './inputs';

const id = z.string().refine(isUlid, 'must be a ULID');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const text = (max: number) => z.string().trim().max(max).nullish();

async function loadCycle(ctx: TenantContext, cycleId: string) {
  const c = await getById(cycleId, ctx);
  if (!c || c['entityType'] !== 'ProductionCycle')
    throw notFound('Cycle not found');
  return c;
}

/** Zone (required) and space (optional) must be this farm's. */
async function checkPlace(
  ctx: TenantContext,
  farmId: string,
  zoneId: string,
  spaceId?: string | null
) {
  const zone = await requireItem(
    keys.zone(ctx.access.tenantId, farmId, zoneId),
    ctx,
    'Zone'
  );
  if (spaceId) {
    const space = await requireItem(
      keys.space(ctx.access.tenantId, farmId, spaceId),
      ctx,
      'Growing space'
    );
    if (space['parentZoneId'] && space['parentZoneId'] !== zoneId)
      throw new ApiError(
        'VALIDATION',
        'growingSpaceId: that space is in another zone'
      );
  }
  return zone;
}

const cycleFields = {
  name: z.string().trim().min(1).max(120),
  cropName: z.string().trim().min(1).max(60),
  variety: text(60),
  zoneId: id,
  growingSpaceId: id.nullish(),
  plantedAt: isoDate.nullish(),
  expectedEndAt: isoDate.nullish(),
  estimatedPlantCount: z.number().int().min(0).max(1_000_000).nullish(),
  areaUsed: z.number().min(0).max(1_000_000).nullish(),
  areaUnit: z.enum(AREA_UNITS).nullish(),
  notes: text(2000),
};

export const createCycle = tenantOperation({
  name: 'createCycle',
  entitlement: 'cycle.manage',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    cycleId: id,
    status: z.enum(['PLANNED', 'ACTIVE']).nullish(),
    ...cycleFields,
  }),
  handler: async (input, ctx) => {
    const zone = await checkPlace(
      ctx,
      input.farmId,
      input.zoneId,
      input.growingSpaceId
    );
    const item = await createWithAudit({
      ctx,
      key: keys.cycle(ctx.access.tenantId, input.farmId, input.cycleId),
      id: input.cycleId,
      entityType: 'ProductionCycle',
      attributes: {
        farmId: input.farmId,
        zoneId: input.zoneId,
        zoneName: zone['name'],
        growingSpaceId: input.growingSpaceId ?? undefined,
        name: input.name,
        cropName: input.cropName,
        cropCode: cropCodeOf(input.cropName),
        variety: input.variety ?? undefined,
        plantedAt: input.plantedAt ?? undefined,
        expectedEndAt: input.expectedEndAt ?? undefined,
        estimatedPlantCount: input.estimatedPlantCount ?? undefined,
        areaUsed: input.areaUsed ?? undefined,
        areaUnit:
          input.areaUsed != null ? (input.areaUnit ?? 'SQ_M') : undefined,
        notes: input.notes ?? undefined,
        status: input.status ?? 'ACTIVE',
        activityCount: 0,
        harvestCount: 0,
      },
      action: 'cycle.create',
    });
    return toView(item);
  },
});

/** Fields that may be cleared with null on update. */
const CLEARABLE = [
  'variety',
  'growingSpaceId',
  'plantedAt',
  'expectedEndAt',
  'estimatedPlantCount',
  'areaUsed',
  'areaUnit',
  'notes',
] as const;
const REQUIRED = ['name', 'cropName', 'zoneId'] as const;

export const updateCycle = tenantOperation({
  name: 'updateCycle',
  entitlement: 'cycle.manage',
  input: z.object({
    tenantId: z.string().min(1),
    cycleId: id,
    expectedVersion: z.number().int().positive(),
    status: z
      .enum(['PLANNED', 'ACTIVE', 'HARVESTING', 'COMPLETED', 'CANCELLED'])
      .nullish(),
    statusDate: isoDate.nullish(),
    name: cycleFields.name.nullish(),
    cropName: cycleFields.cropName.nullish(),
    variety: cycleFields.variety,
    zoneId: id.nullish(),
    growingSpaceId: cycleFields.growingSpaceId,
    plantedAt: cycleFields.plantedAt,
    expectedEndAt: cycleFields.expectedEndAt,
    estimatedPlantCount: cycleFields.estimatedPlantCount,
    areaUsed: cycleFields.areaUsed,
    areaUnit: cycleFields.areaUnit,
    notes: cycleFields.notes,
  }),
  handler: async (input, ctx) => {
    const cycle = await loadCycle(ctx, input.cycleId);
    const from = cycle['status'] as CycleStatus;
    const changes: Item = {};
    if (input.status && input.status !== from) {
      if (!canMoveCycle(from, input.status))
        throw new ApiError(
          'VALIDATION',
          `status: a ${from.toLowerCase()} cycle can't become ${input.status.toLowerCase()}`
        );
      changes['status'] = input.status;
      const when = input.statusDate ?? ctx.now.slice(0, 10);
      if (input.status === 'ACTIVE' && !cycle['plantedAt'])
        changes['plantedAt'] = when;
      if (input.status === 'COMPLETED' || input.status === 'CANCELLED')
        changes['endedAt'] = when;
      if (input.status === 'HARVESTING' && from === 'COMPLETED')
        changes['endedAt'] = null;
    }
    for (const k of REQUIRED) if (input[k] != null) changes[k] = input[k];
    for (const k of CLEARABLE)
      if (input[k] !== undefined) changes[k] = input[k];
    if (input.zoneId || input.growingSpaceId) {
      const zoneId = input.zoneId ?? String(cycle['zoneId']);
      const zone = await checkPlace(
        ctx,
        String(cycle['farmId']),
        zoneId,
        input.growingSpaceId === undefined
          ? (cycle['growingSpaceId'] as string | undefined)
          : input.growingSpaceId
      );
      changes['zoneName'] = zone['name'];
    }
    if (input.cropName) changes['cropCode'] = cropCodeOf(input.cropName);
    const item = await updateWithAudit({
      ctx,
      key: { PK: String(cycle['PK']), SK: String(cycle['SK']) },
      expectedVersion: input.expectedVersion,
      changes,
      action: changes['status']
        ? `cycle.${String(changes['status']).toLowerCase()}`
        : 'cycle.update',
    });
    return toView(item);
  },
});

export const listCycles = tenantOperation({
  name: 'listCycles',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    includeClosed: z.boolean().nullish(),
    zoneId: id.nullish(),
  }),
  handler: async (input, ctx) => {
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      keys.prefix.cycles
    );
    return items
      .filter(c => input.includeClosed || isOpenCycle(String(c['status'])))
      .filter(c => !input.zoneId || c['zoneId'] === input.zoneId)
      .sort((a, b) =>
        String(b['plantedAt'] ?? b['createdAt']).localeCompare(
          String(a['plantedAt'] ?? a['createdAt'])
        )
      )
      .map(c => toView(c));
  },
});

export const getCycle = tenantOperation({
  name: 'getCycle',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), cycleId: id }),
  handler: async (input, ctx) => {
    const cycle = await loadCycle(ctx, input.cycleId);
    const activities = await queryPrefix(
      keys.activityPk(ctx.access.tenantId, input.cycleId),
      'A#'
    );
    return {
      cycle: toView(cycle),
      // AC-MA-002: chronological history, newest first
      activities: activities
        .filter(a => !a['deletedAt'])
        .sort((a, b) => String(b['SK']).localeCompare(String(a['SK'])))
        .map(a => toView(a)),
    };
  },
});

// ─── Activities (#94) ─────────────────────────────────────────────────────────

/** The thing an activity is about: a cycle, a growing space or a zone. */
async function activityTarget(ctx: TenantContext, targetId: string) {
  const t = await getById(targetId, ctx);
  const kind = t?.['entityType'];
  if (
    !t ||
    !['ProductionCycle', 'GrowingSpace', 'Zone'].includes(String(kind)) ||
    !t['farmId']
  )
    throw notFound('Record not found');
  return t;
}

export const recordActivity = tenantOperation({
  name: 'recordActivity',
  entitlement: 'activity.record',
  input: z.object({
    tenantId: z.string().min(1),
    activityId: id,
    targetId: id,
    activityType: z.enum(ACTIVITY_TYPES),
    activityDate: isoDate,
    notes: text(2000),
    quantity: z.number().positive().max(1_000_000).nullish(),
    unit: text(20),
    materialName: text(120),
    /** Farm input used: its stock goes down by `quantity` (in the item's unit). */
    inputItemId: id.nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const target = await activityTarget(ctx, input.targetId);
    if (
      target['entityType'] === 'ProductionCycle' &&
      target['status'] === 'CANCELLED'
    )
      throw new ApiError('VALIDATION', 'cycle: this cycle was cancelled');
    const key = keys.activity(
      tenantId,
      input.targetId,
      input.activityDate,
      input.activityId
    );
    const existing = await getItem(key);
    if (existing) {
      if (existing['createdBy'] === ctx.userId) return toView(existing); // retry
      throw new ApiError('CONFLICT', 'Id already in use');
    }

    let input_: Item | null = null;
    if (input.inputItemId) {
      if (!input.quantity)
        throw new ApiError('VALIDATION', 'quantity: say how much was used');
      input_ = await loadInputItem(ctx, input.inputItemId);
      if (input_['farmId'] !== target['farmId'])
        throw notFound('Farm input not found');
      if (input_['status'] === 'ARCHIVED')
        throw new ApiError('VALIDATION', 'inputItemId: that item is archived');
    }

    const activity: Item = {
      ...key,
      ...keys.byId(input.activityId),
      GSI2SK: 'FARMACTIVITY',
      entityType: 'FarmActivity',
      id: input.activityId,
      tenantId,
      farmId: target['farmId'],
      targetId: input.targetId,
      targetType: target['entityType'],
      productionCycleId:
        target['entityType'] === 'ProductionCycle' ? input.targetId : undefined,
      zoneId:
        target['entityType'] === 'Zone'
          ? input.targetId
          : (target['zoneId'] ?? target['parentZoneId']),
      activityType: input.activityType,
      activityDate: input.activityDate,
      notes: input.notes ?? undefined,
      quantity: input.quantity ?? undefined,
      unit: input_ ? input_['unit'] : (input.unit ?? undefined),
      materialName: input_ ? input_['name'] : (input.materialName ?? undefined),
      inputItemId: input.inputItemId ?? undefined,
      version: 1,
      createdAt: ctx.now,
      createdBy: ctx.userId,
      updatedAt: ctx.now,
      updatedBy: ctx.userId,
    };
    const clean = Object.fromEntries(
      Object.entries(activity).filter(([, v]) => v !== undefined)
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
    if (input_ && input.quantity) {
      items.push(
        ...inputMovementWrites(ctx, input_, `ACT#${input.activityId}`, {
          type: 'STOCK_OUT',
          quantity: input.quantity,
          date: input.activityDate,
          notes: `${input.activityType.toLowerCase().replace(/_/g, ' ')}: ${String(target['name'] ?? '')}`,
        }).items
      );
    }
    if (target['entityType'] === 'ProductionCycle') {
      // Count on the cycle for lists; version-conditioned like any edit
      items.push({
        Put: {
          TableName: tableName(),
          Item: {
            ...target,
            activityCount: Number(target['activityCount'] ?? 0) + 1,
            lastActivityAt:
              input.activityDate > String(target['lastActivityAt'] ?? '')
                ? input.activityDate
                : target['lastActivityAt'],
            version: Number(target['version']) + 1,
            updatedAt: ctx.now,
          },
          ConditionExpression: 'version = :v AND tenantId = :t',
          ExpressionAttributeValues: {
            ':v': target['version'],
            ':t': tenantId,
          },
        },
      });
    }
    try {
      await ddb.send(new TransactWriteCommand({ TransactItems: items }));
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      const again = await getItem(key);
      if (again && again['createdBy'] === ctx.userId) return toView(again);
      throw new ApiError(
        'CONFLICT',
        'Something changed meanwhile; please try again'
      );
    }
    return toView(clean);
  },
});

export const listActivities = tenantOperation({
  name: 'listActivities',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), targetId: id }),
  handler: async (input, ctx) => {
    await activityTarget(ctx, input.targetId);
    const items = await queryPrefix(
      keys.activityPk(ctx.access.tenantId, input.targetId),
      'A#'
    );
    return items
      .filter(a => !a['deletedAt'])
      .sort((a, b) => String(b['SK']).localeCompare(String(a['SK'])))
      .map(a => toView(a));
  },
});

export const archiveActivity = tenantOperation({
  name: 'archiveActivity',
  entitlement: 'record.archive',
  input: z.object({
    tenantId: z.string().min(1),
    activityId: id,
    expectedVersion: z.number().int().positive(),
  }),
  handler: async (input, ctx) => {
    const a = await getById(input.activityId, ctx);
    if (!a || a['entityType'] !== 'FarmActivity')
      throw notFound('Activity not found');
    // Input stock used is NOT returned automatically: it was really used.
    const item = await updateWithAudit({
      ctx,
      key: { PK: String(a['PK']), SK: String(a['SK']) },
      expectedVersion: input.expectedVersion,
      changes: { deletedAt: ctx.now, deletedBy: ctx.userId },
      action: 'activity.archive',
    });
    return toView(item);
  },
});
