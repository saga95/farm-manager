/**
 * Production cycles and farm activities (SRS §6.3, §14, §41.3, §41.4).
 *
 * A ProductionCycle is one planting of a crop in a zone (optionally a bed /
 * grow-bag area = GrowingSpace), managed as a GROUP: "Ginger 2026-01, 180
 * plants" never needs 180 plant records (AC-PC-001). Activities and harvests
 * attach to the cycle for its whole life; completing a cycle keeps them
 * (AC-PC-004).
 */

export const CYCLE_STATUSES = [
  'PLANNED',
  'ACTIVE',
  'HARVESTING',
  'COMPLETED',
  'CANCELLED',
] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const OPEN_CYCLE_STATUSES: readonly CycleStatus[] = [
  'PLANNED',
  'ACTIVE',
  'HARVESTING',
];
export const CLOSED_CYCLE_STATUSES: readonly CycleStatus[] = [
  'COMPLETED',
  'CANCELLED',
];

const ORDER: Record<CycleStatus, number> = {
  PLANNED: 0,
  ACTIVE: 1,
  HARVESTING: 2,
  COMPLETED: 3,
  CANCELLED: 3,
};

/**
 * Allowed moves: forward through PLANNED → ACTIVE → HARVESTING → COMPLETED
 * (steps may be skipped), CANCELLED from any open status, and re-opening a
 * COMPLETED cycle back to HARVESTING (a late harvest). Never backwards past
 * that, never out of CANCELLED.
 */
export function canMoveCycle(from: CycleStatus, to: CycleStatus): boolean {
  if (from === to) return false;
  if (from === 'CANCELLED') return false;
  if (from === 'COMPLETED') return to === 'HARVESTING';
  if (to === 'CANCELLED') return true;
  return ORDER[to] > ORDER[from];
}

/** Statuses a user can pick next (for buttons). */
export function nextCycleStatuses(from: CycleStatus): CycleStatus[] {
  return CYCLE_STATUSES.filter(to => canMoveCycle(from, to));
}

export const isOpenCycle = (s: string) =>
  (OPEN_CYCLE_STATUSES as readonly string[]).includes(s);

/** Activity types (§41.4). */
export const ACTIVITY_TYPES = [
  'WATERING',
  'FERTILIZER',
  'WEEDING',
  'MULCHING',
  'PRUNING',
  'STAKING_OR_TRELLIS',
  'PEST_OR_DISEASE_OBSERVATION',
  'TREATMENT',
  'PLANTING',
  'TRANSPLANTING',
  'GENERAL_NOTE',
  'OTHER',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Types that commonly use a farm input (fertiliser, spray, seed, mulch). */
export const INPUT_ACTIVITY_TYPES: readonly ActivityType[] = [
  'FERTILIZER',
  'TREATMENT',
  'MULCHING',
  'PLANTING',
  'TRANSPLANTING',
];

/**
 * Stable crop code from a free-text crop name ("Bell pepper" → BELL_PEPPER),
 * used to group produce batches by crop. Coconut keeps its system code.
 */
export function cropCodeOf(name: string): string {
  const code = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
  return code || 'OTHER';
}

/** "Ginger 2026-01" style default name for a new cycle. */
export function defaultCycleName(cropName: string, startDate: string): string {
  return `${cropName.trim()} ${startDate.slice(0, 7)}`;
}
