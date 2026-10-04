/**
 * Next-plucking prediction, method "median-v1" (SRS §10.1, §41.8, CALC-004..007,
 * ADR-0001/§26.5: pure + versioned, no DB/UI coupling).
 *
 * Method (documented, deterministic, unit-tested; changing ANY constant here
 * requires a new METHOD_VERSION, see §41.8):
 *  1. Valid harvests: not deleted, not excluded from prediction, quantity recorded.
 *     Several records on the same date count as one plucking.
 *  2. Intervals = calendar-day gaps between consecutive valid dates (N dates → N−1 intervals).
 *  3. Typical interval = median of intervals (CALC-005).
 *  4. Central estimate = last valid date + median (CALC-006).
 *  5. Window = estimate ± spread, spread = clamp(MAD, MIN_SPREAD, median × MAX_SPREAD_RATIO)
 *     where MAD is the median absolute deviation of the intervals.
 *  6. Confidence by interval count: 0 → NO_PREDICTION, 1–2 → LOW, 3–5 → MEDIUM, ≥6 → HIGH.
 *     Downgraded one level when intervals are "highly inconsistent":
 *     coefficient of variation (stdev / mean) > CV_THRESHOLD, needs ≥2 intervals.
 *     LOW is the floor: a single estimate is still shown, clearly labelled.
 */

export const METHOD_VERSION = 'median-v1';
/** #70 decision: CV above 0.35 = highly inconsistent (downgrade one level). */
export const CV_THRESHOLD = 0.35;
export const MIN_SPREAD_DAYS = 3;
export const MAX_SPREAD_RATIO = 0.5;

export type Confidence = 'NO_PREDICTION' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface DatedHarvest {
  harvestDate: string; // YYYY-MM-DD
  quantity?: number | null;
  deletedAt?: string | null;
  excludeFromPrediction?: boolean | null;
}

export interface Prediction {
  methodVersion: string;
  confidence: Confidence;
  intervalCount: number;
  /** Number of distinct valid plucking dates used */
  harvestCount: number;
  lastHarvestDate: string | null;
  medianIntervalDays: number | null;
  /** Coefficient of variation of intervals (null with < 2 intervals) */
  variability: number | null;
  highlyInconsistent: boolean;
  estimateDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
}

const DAY_MS = 86_400_000;
const toDay = (iso: string) =>
  Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const fromDay = (day: number) =>
  new Date(day * DAY_MS).toISOString().slice(0, 10);

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2
    ? (s[mid] as number)
    : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Distinct valid plucking dates, ascending (rule 1). */
export function validDates(harvests: readonly DatedHarvest[]): string[] {
  const dates = harvests
    .filter(h => !h.deletedAt && !h.excludeFromPrediction && h.quantity != null)
    .map(h => h.harvestDate);
  return [...new Set(dates)].sort();
}

/** CALC-004: calendar-day gaps between consecutive dates. */
export function intervals(dates: readonly string[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < dates.length; i += 1) {
    out.push(toDay(dates[i] as string) - toDay(dates[i - 1] as string));
  }
  return out;
}

export function coefficientOfVariation(
  values: readonly number[]
): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return null;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

const LEVELS: Confidence[] = ['NO_PREDICTION', 'LOW', 'MEDIUM', 'HIGH'];

export function confidenceFor(
  intervalCount: number,
  highlyInconsistent: boolean
): Confidence {
  const base: Confidence =
    intervalCount === 0
      ? 'NO_PREDICTION'
      : intervalCount <= 2
        ? 'LOW'
        : intervalCount <= 5
          ? 'MEDIUM'
          : 'HIGH';
  if (!highlyInconsistent || base === 'NO_PREDICTION' || base === 'LOW')
    return base;
  return LEVELS[LEVELS.indexOf(base) - 1] as Confidence;
}

export function predictNextPlucking(
  harvests: readonly DatedHarvest[]
): Prediction {
  const dates = validDates(harvests);
  const gaps = intervals(dates);
  const last = dates.at(-1) ?? null;
  const cv = coefficientOfVariation(gaps);
  const highlyInconsistent = cv !== null && cv > CV_THRESHOLD;
  const confidence = confidenceFor(gaps.length, highlyInconsistent);

  if (gaps.length === 0 || !last) {
    return {
      methodVersion: METHOD_VERSION,
      confidence: 'NO_PREDICTION',
      intervalCount: 0,
      harvestCount: dates.length,
      lastHarvestDate: last,
      medianIntervalDays: null,
      variability: null,
      highlyInconsistent: false,
      estimateDate: null,
      windowStart: null,
      windowEnd: null,
    };
  }

  const med = median(gaps);
  const mad = median(gaps.map(g => Math.abs(g - med)));
  const spread = Math.round(
    Math.min(Math.max(mad, MIN_SPREAD_DAYS), med * MAX_SPREAD_RATIO)
  );
  const estimateDay = toDay(last) + Math.round(med);

  return {
    methodVersion: METHOD_VERSION,
    confidence,
    intervalCount: gaps.length,
    harvestCount: dates.length,
    lastHarvestDate: last,
    medianIntervalDays: Math.round(med * 10) / 10,
    variability: cv === null ? null : Math.round(cv * 100) / 100,
    highlyInconsistent,
    estimateDate: fromDay(estimateDay),
    windowStart: fromDay(estimateDay - spread),
    windowEnd: fromDay(estimateDay + spread),
  };
}

// ─── Due-soon grouping (§10.2) ─────────────────────────────────────────────────

export type DueBucket =
  | 'OVERDUE'
  | 'DUE_SOON'
  | 'UPCOMING'
  | 'NOT_ENOUGH_HISTORY';
export const DUE_BUCKETS: readonly DueBucket[] = [
  'OVERDUE',
  'DUE_SOON',
  'UPCOMING',
  'NOT_ENOUGH_HISTORY',
];

/** Configurable (§10.2): a tree is "due soon" from this many days before its window opens. */
export const DUE_SOON_LEAD_DAYS = 7;

export function dueBucket(
  p: Pick<Prediction, 'windowStart' | 'windowEnd'>,
  today: string
): DueBucket {
  if (!p.windowStart || !p.windowEnd) return 'NOT_ENOUGH_HISTORY';
  const t = toDay(today);
  if (t > toDay(p.windowEnd)) return 'OVERDUE';
  if (t >= toDay(p.windowStart) - DUE_SOON_LEAD_DAYS) return 'DUE_SOON';
  return 'UPCOMING';
}

export function daysBetween(fromIso: string, toIso: string): number {
  return toDay(toIso) - toDay(fromIso);
}
