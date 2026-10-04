/**
 * Dehusked sample & size history rules (SRS §9, §41.6, §41.10, CALC-008/009).
 *
 * A sample describes ONE coconut from a tree's harvest. It is evidence about the
 * likely size, never a classification of the harvested batch, and never stock.
 * "No sample record" (not sampled) ≠ a sample with sizeClass UNCLASSIFIED.
 */

export const SIZE_CLASSES = [
  'SMALL',
  'MEDIUM',
  'LARGE',
  'UNCLASSIFIED',
] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];
/** Sizes that carry size evidence (UNCLASSIFIED is a sample without a size). */
export const CLASSIFIED_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export type ClassifiedSize = (typeof CLASSIFIED_SIZES)[number];

export const WEIGHT_UNITS = ['G', 'KG'] as const;
export const MEASUREMENT_UNITS = ['CM', 'IN'] as const;

/** How many most-recent samples make up the "recent" sequence. */
export const RECENT_SAMPLE_COUNT = 5;
/** Minimum classified samples before naming a "usual" (modal) size. */
export const MIN_SAMPLES_FOR_TENDENCY = 3;

export interface SampleLike {
  sampledAt: string; // YYYY-MM-DD (harvest/sample date)
  sizeClass: SizeClass;
  deletedAt?: string | null;
}

export interface SizeHistory {
  /** CALC-008: newest valid sample's size, or null when never sampled */
  latest: SizeClass | null;
  latestDate: string | null;
  /** CALC-009: denominator is samples, not coconuts */
  sampleCount: number;
  counts: Record<SizeClass, number>;
  /** Newest first, up to RECENT_SAMPLE_COUNT */
  recent: SizeClass[];
  /** Most frequent classified size among recent samples; null if too few or tied */
  tendency: ClassifiedSize | null;
  /** How many of `recent` match the tendency (for "4 of the last 5 were Medium") */
  tendencyMatches: number;
}

export function sizeHistory(samples: readonly SampleLike[]): SizeHistory {
  const valid = samples
    .filter(s => !s.deletedAt)
    .sort((a, b) => b.sampledAt.localeCompare(a.sampledAt));
  const counts: Record<SizeClass, number> = {
    SMALL: 0,
    MEDIUM: 0,
    LARGE: 0,
    UNCLASSIFIED: 0,
  };
  valid.forEach(s => {
    counts[s.sizeClass] += 1;
  });
  const recent = valid.slice(0, RECENT_SAMPLE_COUNT).map(s => s.sizeClass);
  const recentClassified = recent.filter(
    (s): s is ClassifiedSize => s !== 'UNCLASSIFIED'
  );

  let tendency: ClassifiedSize | null = null;
  let tendencyMatches = 0;
  if (recentClassified.length >= MIN_SAMPLES_FOR_TENDENCY) {
    const tally = CLASSIFIED_SIZES.map(size => ({
      size,
      n: recentClassified.filter(s => s === size).length,
    }));
    const max = Math.max(...tally.map(t => t.n));
    const leaders = tally.filter(t => t.n === max);
    if (leaders.length === 1) {
      tendency = leaders[0]!.size;
      tendencyMatches = max;
    }
  }

  return {
    latest: valid[0]?.sizeClass ?? null,
    latestDate: valid[0]?.sampledAt ?? null,
    sampleCount: valid.length,
    counts,
    recent,
    tendency,
    tendencyMatches,
  };
}

/**
 * Size-tendency filter for buyer matching (§9.4, US-011): does this tree's
 * evidence suggest `size` is likely? Latest sample OR recent tendency matches.
 * Decision support only, never a guarantee of available quantity by size.
 */
export function suggestsSize(
  history: Pick<SizeHistory, 'latest' | 'tendency'>,
  size: ClassifiedSize
): boolean {
  return history.latest === size || history.tendency === size;
}
