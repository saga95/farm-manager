/**
 * Zone / growing-space form models: string form values ↔ typed API input.
 * Empty optional fields become null (missing ≠ zero, PR-007).
 */

import { z } from 'zod';
import {
  AREA_UNITS,
  DRAINAGE,
  LENGTH_UNITS,
  LEVELS,
  SLOPE,
  SPACE_TYPES,
  SURFACE_TYPES,
  WATER_ACCESS,
  ZONE_TYPES,
} from '@/domain/farm';
import type { GrowingSpace, SpaceInput, Zone, ZoneInput } from '@/lib/api';

export interface FormMessages {
  required: string;
  positive: string;
}

const optionalNumber = (m: FormMessages) =>
  z
    .string()
    .trim()
    .transform(v => (v === '' ? null : Number(v)))
    .refine(v => v === null || (Number.isFinite(v) && v > 0), m.positive);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(v => (v === '' ? null : v));

/** '' means "not set" in selects. */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('')])
    .transform(v => (v === '' ? null : v));

// ─── Zone ───────────────────────────────────────────────────────────────────────

export type ZoneFormValues = {
  name: string;
  zoneType: string;
  description: string;
  area: string;
  areaUnit: string;
};

export const emptyZoneForm = (): ZoneFormValues => ({
  name: '',
  zoneType: 'COCONUT_AREA',
  description: '',
  area: '',
  areaUnit: 'ACRE',
});

export const zoneToForm = (z: Zone): ZoneFormValues => ({
  name: z.name,
  zoneType: z.zoneType,
  description: z.description ?? '',
  area: z.area != null ? String(z.area) : '',
  areaUnit: z.areaUnit ?? 'ACRE',
});

export const zoneFormSchema = (m: FormMessages) =>
  z
    .object({
      name: z.string().trim().min(1, m.required).max(80),
      zoneType: z.enum(ZONE_TYPES),
      description: optionalText(500),
      area: optionalNumber(m),
      areaUnit: z.enum(AREA_UNITS),
    })
    .transform(
      (v): ZoneInput => ({
        name: v.name,
        zoneType: v.zoneType,
        description: v.description,
        area: v.area,
        areaUnit: v.area === null ? null : v.areaUnit,
      })
    );

// ─── Growing space ──────────────────────────────────────────────────────────────

export type SpaceFormValues = {
  name: string;
  spaceType: string;
  parentZoneId: string;
  width: string;
  length: string;
  lengthUnit: string;
  sunlightLevel: string;
  shadeLevel: string;
  waterAccess: string;
  drainage: string;
  slope: string;
  surfaceType: string;
  currentUse: string;
  notes: string;
};

export const SPACE_CONDITION_FIELDS = [
  ['sunlightLevel', LEVELS, 'sunlight'],
  ['shadeLevel', LEVELS, 'shade'],
  ['waterAccess', WATER_ACCESS, 'water'],
  ['drainage', DRAINAGE, 'drainage'],
  ['slope', SLOPE, 'slope'],
  ['surfaceType', SURFACE_TYPES, 'surface'],
] as const;

export const emptySpaceForm = (): SpaceFormValues => ({
  name: '',
  spaceType: 'OPEN_GROUND',
  parentZoneId: '',
  width: '',
  length: '',
  lengthUnit: 'M',
  sunlightLevel: '',
  shadeLevel: '',
  waterAccess: '',
  drainage: '',
  slope: '',
  surfaceType: '',
  currentUse: '',
  notes: '',
});

export const spaceToForm = (s: GrowingSpace): SpaceFormValues => ({
  name: s.name,
  spaceType: s.spaceType,
  parentZoneId: s.parentZoneId ?? '',
  width: s.width != null ? String(s.width) : '',
  length: s.length != null ? String(s.length) : '',
  lengthUnit: s.lengthUnit ?? 'M',
  sunlightLevel: s.sunlightLevel ?? '',
  shadeLevel: s.shadeLevel ?? '',
  waterAccess: s.waterAccess ?? '',
  drainage: s.drainage ?? '',
  slope: s.slope ?? '',
  surfaceType: s.surfaceType ?? '',
  currentUse: s.currentUse ?? '',
  notes: s.notes ?? '',
});

export const spaceFormSchema = (m: FormMessages) =>
  z
    .object({
      name: z.string().trim().min(1, m.required).max(80),
      spaceType: z.enum(SPACE_TYPES),
      parentZoneId: z.string().transform(v => (v === '' ? null : v)),
      width: optionalNumber(m),
      length: optionalNumber(m),
      lengthUnit: z.enum(LENGTH_UNITS),
      sunlightLevel: optionalEnum(LEVELS),
      shadeLevel: optionalEnum(LEVELS),
      waterAccess: optionalEnum(WATER_ACCESS),
      drainage: optionalEnum(DRAINAGE),
      slope: optionalEnum(SLOPE),
      surfaceType: optionalEnum(SURFACE_TYPES),
      currentUse: optionalText(200),
      notes: optionalText(1000),
    })
    .transform((v): SpaceInput => v);

/** First error message per field, for form helper text. */
export function fieldErrors(
  issues: readonly z.ZodIssue[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? '');
    if (k && !out[k]) out[k] = i.message;
  }
  return out;
}
