/**
 * Farm, Zone and GrowingSpace rules (SRS §4.4, §4.5, §41.2). Pure; shared by
 * farm-api handlers, the web UI and the future mobile client.
 */

export const AREA_UNITS = ['ACRE', 'HECTARE', 'PERCH', 'SQ_M'] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const LENGTH_UNITS = ['M', 'FT'] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

/** §4.5 examples, generalised. OTHER keeps the list open for tenants. */
export const ZONE_TYPES = [
  'COCONUT_AREA',
  'POLYTUNNEL',
  'PEPPER_AREA',
  'BANANA_AREA',
  'BACKYARD',
  'STORAGE',
  'OTHER',
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

/** §41.2 initial spaceType values. */
export const SPACE_TYPES = [
  'OPEN_GROUND',
  'BED',
  'RAISED_BED',
  'POLYTUNNEL',
  'GREENHOUSE',
  'GROW_BAG_AREA',
  'CONTAINER_AREA',
  'NARROW_STRIP',
  'UNDER_TREE',
  'OTHER',
] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

/** Site-condition scales (§41.2 sunlight/shade/water/drainage/slope). */
export const LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Level = (typeof LEVELS)[number];
export const WATER_ACCESS = [
  'NONE',
  'CARRIED',
  'TAP_NEARBY',
  'IRRIGATED',
] as const;
export const DRAINAGE = ['POOR', 'FAIR', 'GOOD'] as const;
export const SLOPE = ['FLAT', 'GENTLE', 'STEEP'] as const;
export const SURFACE_TYPES = [
  'SOIL',
  'GRAVEL',
  'CONCRETE',
  'MIXED',
  'OTHER',
] as const;

/** Farms/zones: ACTIVE or ARCHIVED. Spaces add UNUSED (AC-SP-002). */
export const ENTITY_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export const SPACE_STATUSES = ['ACTIVE', 'UNUSED', 'ARCHIVED'] as const;
export type SpaceStatus = (typeof SPACE_STATUSES)[number];

/**
 * calculatedArea for a rectangular space in square metres (§41.2).
 * Returns null unless both dimensions are positive numbers.
 */
export function calculateAreaSqM(
  width: number | null | undefined,
  length: number | null | undefined,
  unit: LengthUnit = 'M'
): number | null {
  if (!width || !length || width <= 0 || length <= 0) return null;
  const toM = unit === 'FT' ? 0.3048 : 1;
  return Math.round(width * toM * length * toM * 100) / 100;
}

/** Square metres per area unit (1 perch = 25.29285264 m², used in Sri Lanka). */
export const SQ_M_PER_UNIT: Record<AreaUnit, number> = {
  SQ_M: 1,
  PERCH: 25.29285264,
  ACRE: 4046.8564224,
  HECTARE: 10_000,
};

export function convertArea(
  value: number,
  from: AreaUnit,
  to: AreaUnit
): number {
  return (value * SQ_M_PER_UNIT[from]) / SQ_M_PER_UNIT[to];
}
