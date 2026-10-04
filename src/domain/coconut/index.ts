/**
 * Crop catalogue and coconut tree registry rules (SRS §6.1, §7.1, PO decision Q-001).
 * Pure; shared by farm-api, web UI and the future mobile client.
 */

// ─── Crop profiles (§6.1) ───────────────────────────────────────────────────────

export const TRACKING_STRATEGIES = [
  'PERMANENT_INDIVIDUAL',
  'GROUP_OR_BED',
  'CONTAINER_GROUP',
  'PRODUCTION_CYCLE',
] as const;
export type TrackingStrategy = (typeof TRACKING_STRATEGIES)[number];

export interface CropProfile {
  code: string;
  name: string;
  trackingStrategy: TrackingStrategy;
  defaultHarvestUnit: 'NUT' | 'KG' | 'COUNT';
  /** Prefix for individually numbered plants (Q-001: coconut C-001, pepper P-001). */
  codePrefix?: string;
}

/** System crop profiles (tenantId = null in §6.1). Tenant-defined crops come with Epic 8. */
export const SYSTEM_CROPS: Readonly<Record<'COCONUT' | 'PEPPER', CropProfile>> =
  {
    COCONUT: {
      code: 'COCONUT',
      name: 'Coconut',
      trackingStrategy: 'PERMANENT_INDIVIDUAL',
      defaultHarvestUnit: 'NUT',
      codePrefix: 'C',
    },
    PEPPER: {
      code: 'PEPPER',
      name: 'Pepper',
      trackingStrategy: 'PERMANENT_INDIVIDUAL',
      defaultHarvestUnit: 'KG',
      codePrefix: 'P',
    },
  };

// ─── Trees (§7.1) ───────────────────────────────────────────────────────────────

export const TREE_STATUSES = [
  'PRODUCING',
  'NON_PRODUCING',
  'YOUNG',
  'TEMPORARILY_INACTIVE',
  'DAMAGED',
  'REMOVED',
  'DEAD',
  'ARCHIVED',
] as const;
export type TreeStatus = (typeof TREE_STATUSES)[number];

/** Statuses counted as "producing" in default analytics (AC-CN-003). */
export const PRODUCTIVE_STATUSES: readonly TreeStatus[] = ['PRODUCING'];

/** Hidden from the default tree list (still searchable with "show all"). */
export const INACTIVE_STATUSES: readonly TreeStatus[] = [
  'REMOVED',
  'DEAD',
  'ARCHIVED',
];

/** User-entered or generated tree codes: letters, digits and hyphens, 1–20 chars. */
export const TREE_CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9-]{0,18}[A-Z0-9])?$/;

export function normalizeTreeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

export function isValidTreeCode(code: string): boolean {
  return TREE_CODE_PATTERN.test(code);
}

export const MAX_BULK_TREES = 500;

export interface BulkCodeOptions {
  /** e.g. 'C' → C-001 (pass '' for plain numbers 001) */
  prefix: string;
  start: number;
  count: number;
  /** zero-padding width (default 3) */
  width?: number;
}

/**
 * Generate sequential tree codes (FR-CN-001, Q-001 default C-001…C-050).
 * Throws for invalid ranges so callers can surface a validation error.
 */
export function generateTreeCodes({
  prefix,
  start,
  count,
  width = 3,
}: BulkCodeOptions): string[] {
  if (!Number.isInteger(start) || start < 0)
    throw new RangeError('start must be a non-negative integer');
  if (!Number.isInteger(count) || count < 1 || count > MAX_BULK_TREES) {
    throw new RangeError(`count must be between 1 and ${MAX_BULK_TREES}`);
  }
  if (!Number.isInteger(width) || width < 1 || width > 6)
    throw new RangeError('width must be 1–6');
  const p = normalizeTreeCode(prefix);
  const codes = Array.from({ length: count }, (_, i) => {
    const n = String(start + i).padStart(width, '0');
    return p ? `${p}-${n}` : n;
  });
  const bad = codes.find(c => !isValidTreeCode(c));
  if (bad) throw new RangeError(`Invalid generated code: ${bad}`);
  return codes;
}

/** Natural sort so C-2 < C-10 and C-002 < C-010. */
export function compareTreeCodes(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

// ─── Tree yield summary (§7.2, CALC-002/003) ───────────────────────────────────

export interface YieldHarvest {
  harvestDate: string;
  quantity?: number | null;
  deletedAt?: string | null;
}

export interface TreeYieldSummary {
  /** Valid recorded harvests (quantity present, not deleted) */
  harvestCount: number;
  lifetimeTotal: number;
  currentYearTotal: number;
  /** CALC-003: total / count; null without records (no history ≠ 0) */
  averagePerHarvest: number | null;
  best: number | null;
  lastHarvestDate: string | null;
  lastQuantity: number | null;
  daysSinceLast: number | null;
}

export function treeYieldSummary(
  harvests: readonly YieldHarvest[],
  today: string
): TreeYieldSummary {
  const valid = harvests
    .filter(h => !h.deletedAt && h.quantity != null)
    .sort((a, b) => a.harvestDate.localeCompare(b.harvestDate));
  const year = today.slice(0, 4);
  const total = valid.reduce((s, h) => s + (h.quantity as number), 0);
  const last = valid.at(-1);
  const dayMs = 86_400_000;
  return {
    harvestCount: valid.length,
    lifetimeTotal: total,
    currentYearTotal: valid
      .filter(h => h.harvestDate.startsWith(year))
      .reduce((s, h) => s + (h.quantity as number), 0),
    averagePerHarvest: valid.length
      ? Math.round((total / valid.length) * 10) / 10
      : null,
    best: valid.length
      ? Math.max(...valid.map(h => h.quantity as number))
      : null,
    lastHarvestDate: last?.harvestDate ?? null,
    lastQuantity: last ? (last.quantity as number) : null,
    daysSinceLast: last
      ? Math.round(
          (Date.parse(`${today}T00:00:00Z`) -
            Date.parse(`${last.harvestDate}T00:00:00Z`)) /
            dayMs
        )
      : null,
  };
}
