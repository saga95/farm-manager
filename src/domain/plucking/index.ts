/**
 * Plucking round rules (SRS §8, CALC-001, DQ-001/008; PO decision 2026-10-04:
 * the plucker selects ~10 trees first, then plucks them in any order).
 * Pure; shared by farm-api, web UI and the future mobile client.
 */

export const ROUND_STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETE',
  'CANCELLED',
] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const RECORD_QUALITIES = [
  'CONFIRMED',
  'APPROXIMATE',
  'INCOMPLETE',
] as const;
export type RecordQuality = (typeof RECORD_QUALITIES)[number];

export const HARVEST_SOURCES = [
  'LIVE_APP',
  'WHATSAPP_BACKFILL',
  'MANUAL_BACKFILL',
] as const;

/** A typical visit is 8–10 trees; allow headroom without unbounded rounds. */
export const MAX_TREES_PER_ROUND = 60;
/** Sanity cap per tree harvest (a coconut tree yields well under this). */
export const MAX_NUTS_PER_TREE = 500;

/** Rounds that can still be planned/recorded. */
export const OPEN_ROUND_STATUSES: readonly RoundStatus[] = [
  'DRAFT',
  'IN_PROGRESS',
];

export type EntryState = 'PENDING' | 'RECORDED' | 'SKIPPED';

export interface HarvestLike {
  treeId: string;
  /** null/undefined = not recorded (never treated as 0, DQ-001) */
  quantity?: number | null;
  deletedAt?: string | null;
}

export interface RoundEntry {
  treeId: string;
  state: EntryState;
}

/**
 * Checklist for the capture screen, in the planned order.
 * Recorded wins over skipped; harvests for unplanned trees are appended
 * (a tree recorded on the spot is still part of the round).
 */
export function roundEntries(
  plannedTreeIds: readonly string[],
  skippedTreeIds: readonly string[],
  harvests: readonly HarvestLike[]
): RoundEntry[] {
  const recorded = new Set(
    harvests.filter(h => !h.deletedAt && h.quantity != null).map(h => h.treeId)
  );
  const skipped = new Set(skippedTreeIds);
  const order = [
    ...plannedTreeIds,
    ...[...recorded].filter(id => !plannedTreeIds.includes(id)),
  ];
  return [...new Set(order)].map(treeId => ({
    treeId,
    state: recorded.has(treeId)
      ? 'RECORDED'
      : skipped.has(treeId)
        ? 'SKIPPED'
        : 'PENDING',
  }));
}

/**
 * Save & Next: the next PENDING tree after `currentTreeId` in planned order,
 * wrapping around; null when every tree is recorded or skipped.
 */
export function nextPendingTree(
  entries: readonly RoundEntry[],
  currentTreeId?: string | null
): string | null {
  const pending = entries.filter(e => e.state === 'PENDING');
  if (pending.length === 0) return null;
  const idx = currentTreeId
    ? entries.findIndex(e => e.treeId === currentTreeId)
    : -1;
  for (let i = 1; i <= entries.length; i += 1) {
    const e = entries[(idx + i + entries.length) % entries.length];
    if (e && e.state === 'PENDING' && e.treeId !== currentTreeId)
      return e.treeId;
  }
  return pending[0]?.treeId ?? null;
}

/** CALC-001: round total = sum of valid, non-deleted recorded quantities. */
export function roundTotal(harvests: readonly HarvestLike[]): number {
  return harvests.reduce(
    (sum, h) => (h.deletedAt || h.quantity == null ? sum : sum + h.quantity),
    0
  );
}

export interface RoundSummary {
  planned: number;
  recorded: number;
  skipped: number;
  pending: number;
  totalNuts: number;
}

export function summarizeRound(
  entries: readonly RoundEntry[],
  harvests: readonly HarvestLike[]
): RoundSummary {
  const count = (s: EntryState) => entries.filter(e => e.state === s).length;
  return {
    planned: entries.length,
    recorded: count('RECORDED'),
    skipped: count('SKIPPED'),
    pending: count('PENDING'),
    totalNuts: roundTotal(harvests),
  };
}

/** Quantity must be a whole number of nuts, 0…MAX (0 is a real recorded zero, not "missing"). */
export function isValidQuantity(q: unknown): q is number {
  return (
    typeof q === 'number' &&
    Number.isInteger(q) &&
    q >= 0 &&
    q <= MAX_NUTS_PER_TREE
  );
}
