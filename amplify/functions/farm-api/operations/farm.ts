/**
 * Farm, Zone and GrowingSpace operations (#33–#36, SRS §4.4, §4.5, §41.2).
 * Every operation is tenant-scoped; keys are built only from the verified tenant.
 */

import { z } from 'zod';
import {
  AREA_UNITS,
  DRAINAGE,
  ENTITY_STATUSES,
  LENGTH_UNITS,
  LEVELS,
  SLOPE,
  SPACE_STATUSES,
  SPACE_TYPES,
  SURFACE_TYPES,
  WATER_ACCESS,
  ZONE_TYPES,
  calculateAreaSqM,
} from '../../../../src/domain/farm';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  createWithAudit,
  queryPrefix,
  requireItem,
  toView,
  updateWithAudit,
} from '../lib/crud';
import { ApiError } from '../lib/errors';
import { type TenantContext, tenantOperation } from '../lib/operation';

const id = z.string().refine(isUlid, 'must be a ULID');
const name = z.string().trim().min(1).max(80);
const text = (max: number) => z.string().trim().max(max).nullish();
const positive = z.number().positive().max(1_000_000).nullish();
const version = z.number().int().positive();
const scoped = { tenantId: z.string().min(1) };

const byName = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  String(a['name']).localeCompare(String(b['name']));

async function requireFarm(ctx: TenantContext, farmId: string) {
  return requireItem(keys.farm(ctx.access.tenantId, farmId), ctx, 'Farm');
}

// ─── Farms ──────────────────────────────────────────────────────────────────────

export const listFarms = tenantOperation({
  name: 'listFarms',
  entitlement: 'farm.view',
  input: z.object({ ...scoped, includeArchived: z.boolean().nullish() }),
  handler: async (input, ctx) => {
    const items = await queryPrefix(
      keys.tenantPk(ctx.access.tenantId),
      keys.prefix.farms
    );
    return items
      .filter(i => input.includeArchived || i['status'] !== 'ARCHIVED')
      .sort(byName)
      .map(i => toView(i));
  },
});

export const updateFarm = tenantOperation({
  name: 'updateFarm',
  entitlement: 'farm.manage',
  input: z.object({
    ...scoped,
    farmId: id,
    expectedVersion: version,
    name: name.nullish(),
    description: text(500),
    area: positive,
    areaUnit: z.enum(AREA_UNITS).nullish(),
    locationLabel: text(120),
    status: z.enum(ENTITY_STATUSES).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId: _t, farmId, expectedVersion, ...changes } = input;
    const updated = await updateWithAudit({
      ctx,
      key: keys.farm(ctx.access.tenantId, farmId),
      expectedVersion,
      changes: {
        ...changes,
        archivedAt: changes.status === 'ARCHIVED' ? ctx.now : undefined,
      },
      action: 'farm.update',
    });
    return toView(updated);
  },
});

// ─── Zones ──────────────────────────────────────────────────────────────────────

const zoneFields = {
  name,
  zoneType: z.enum(ZONE_TYPES),
  description: text(500),
  area: positive,
  areaUnit: z.enum(AREA_UNITS).nullish(),
};

export const listZones = tenantOperation({
  name: 'listZones',
  entitlement: 'farm.view',
  input: z.object({
    ...scoped,
    farmId: id,
    includeArchived: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    await requireFarm(ctx, input.farmId);
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      keys.prefix.zones
    );
    return items
      .filter(i => input.includeArchived || i['status'] !== 'ARCHIVED')
      .sort(byName)
      .map(i => toView(i));
  },
});

export const createZone = tenantOperation({
  name: 'createZone',
  entitlement: 'zone.manage',
  input: z.object({ ...scoped, farmId: id, zoneId: id, ...zoneFields }),
  handler: async (input, ctx) => {
    await requireFarm(ctx, input.farmId);
    const { tenantId: _t, zoneId, ...attrs } = input;
    const item = await createWithAudit({
      ctx,
      key: keys.zone(ctx.access.tenantId, input.farmId, zoneId),
      id: zoneId,
      entityType: 'Zone',
      attributes: { ...attrs, status: 'ACTIVE' },
      action: 'zone.create',
    });
    return toView(item);
  },
});

export const updateZone = tenantOperation({
  name: 'updateZone',
  entitlement: 'zone.manage',
  input: z.object({
    ...scoped,
    farmId: id,
    zoneId: id,
    expectedVersion: version,
    name: name.nullish(),
    zoneType: z.enum(ZONE_TYPES).nullish(),
    description: text(500),
    area: positive,
    areaUnit: z.enum(AREA_UNITS).nullish(),
    status: z.enum(ENTITY_STATUSES).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId: _t, farmId, zoneId, expectedVersion, ...changes } = input;
    const updated = await updateWithAudit({
      ctx,
      key: keys.zone(ctx.access.tenantId, farmId, zoneId),
      expectedVersion,
      changes: {
        ...changes,
        archivedAt: changes.status === 'ARCHIVED' ? ctx.now : undefined,
      },
      action: 'zone.update',
    });
    return toView(updated);
  },
});

// ─── Growing spaces (§41.2) ─────────────────────────────────────────────────────

const spaceFields = {
  name,
  spaceType: z.enum(SPACE_TYPES),
  parentZoneId: id.nullish(),
  width: positive,
  length: positive,
  lengthUnit: z.enum(LENGTH_UNITS).nullish(),
  sunlightLevel: z.enum(LEVELS).nullish(),
  shadeLevel: z.enum(LEVELS).nullish(),
  waterAccess: z.enum(WATER_ACCESS).nullish(),
  drainage: z.enum(DRAINAGE).nullish(),
  slope: z.enum(SLOPE).nullish(),
  surfaceType: z.enum(SURFACE_TYPES).nullish(),
  currentUse: text(200),
  notes: text(1000),
};

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
    throw new ApiError('VALIDATION', 'parentZoneId: zone is archived');
}

export const listSpaces = tenantOperation({
  name: 'listSpaces',
  entitlement: 'farm.view',
  input: z.object({
    ...scoped,
    farmId: id,
    status: z.enum(SPACE_STATUSES).nullish(),
    includeArchived: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    await requireFarm(ctx, input.farmId);
    const items = await queryPrefix(
      keys.farmPk(ctx.access.tenantId, input.farmId),
      keys.prefix.spaces
    );
    return items
      .filter(i =>
        input.status
          ? i['status'] === input.status
          : input.includeArchived || i['status'] !== 'ARCHIVED'
      )
      .sort(byName)
      .map(i => toView(i));
  },
});

export const createSpace = tenantOperation({
  name: 'createSpace',
  entitlement: 'space.manage',
  input: z.object({ ...scoped, farmId: id, spaceId: id, ...spaceFields }),
  handler: async (input, ctx) => {
    await requireFarm(ctx, input.farmId);
    await assertZone(ctx, input.farmId, input.parentZoneId);
    const { tenantId: _t, spaceId, ...attrs } = input;
    const item = await createWithAudit({
      ctx,
      key: keys.space(ctx.access.tenantId, input.farmId, spaceId),
      id: spaceId,
      entityType: 'GrowingSpace',
      attributes: {
        ...attrs,
        calculatedAreaSqM: calculateAreaSqM(
          attrs.width,
          attrs.length,
          attrs.lengthUnit ?? 'M'
        ),
        status: 'ACTIVE',
      },
      action: 'space.create',
    });
    return toView(item);
  },
});

export const updateSpace = tenantOperation({
  name: 'updateSpace',
  entitlement: 'space.manage',
  input: z
    .object({
      ...scoped,
      farmId: id,
      spaceId: id,
      expectedVersion: version,
      status: z.enum(SPACE_STATUSES).nullish(),
    })
    .merge(z.object(spaceFields).partial()),
  handler: async (input, ctx) => {
    const {
      tenantId: _t,
      farmId,
      spaceId,
      expectedVersion,
      ...changes
    } = input;
    await assertZone(ctx, farmId, changes.parentZoneId);
    const key = keys.space(ctx.access.tenantId, farmId, spaceId);
    const current = await requireItem(key, ctx, 'Growing space');
    const width =
      changes.width !== undefined
        ? changes.width
        : (current['width'] as number | null);
    const length =
      changes.length !== undefined
        ? changes.length
        : (current['length'] as number | null);
    const unit = (changes.lengthUnit ?? current['lengthUnit'] ?? 'M') as
      | 'M'
      | 'FT';
    const updated = await updateWithAudit({
      ctx,
      key,
      expectedVersion,
      changes: {
        ...changes,
        calculatedAreaSqM: calculateAreaSqM(width, length, unit),
        archivedAt: changes.status === 'ARCHIVED' ? ctx.now : undefined,
      },
      action: 'space.update',
    });
    return toView(updated);
  },
});
