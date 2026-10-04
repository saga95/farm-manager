import {
  CV_THRESHOLD,
  METHOD_VERSION,
  confidenceFor,
  dueBucket,
  intervals,
  median,
  predictNextPlucking,
  validDates,
} from '..';

const h = (harvestDate: string, quantity: number | null = 10, extra = {}) => ({
  harvestDate,
  quantity,
  ...extra,
});

describe('valid harvests and intervals (CALC-004, AC-PD-001/003)', () => {
  it('ignores deleted, excluded and unrecorded harvests; same-day records count once', () => {
    expect(
      validDates([
        h('2026-03-01'),
        h('2026-01-01'),
        h('2026-02-01', null),
        h('2026-04-01', 10, { deletedAt: 'x' }),
        h('2026-05-01', 10, { excludeFromPrediction: true }),
        h('2026-03-01', 4),
      ])
    ).toEqual(['2026-01-01', '2026-03-01']);
  });

  it('computes calendar-day gaps: N dates → N−1 intervals', () => {
    expect(intervals(['2026-01-01', '2026-03-01', '2026-05-01'])).toEqual([
      59, 61,
    ]);
  });

  it('median of even and odd sets', () => {
    expect(median([60, 70, 50])).toBe(60);
    expect(median([60, 70, 50, 80])).toBe(65);
  });
});

describe('confidence (§41.8)', () => {
  it.each([
    [0, false, 'NO_PREDICTION'],
    [1, false, 'LOW'],
    [2, false, 'LOW'],
    [3, false, 'MEDIUM'],
    [5, false, 'MEDIUM'],
    [6, false, 'HIGH'],
    [6, true, 'MEDIUM'],
    [3, true, 'LOW'],
    [2, true, 'LOW'],
  ] as const)(
    '%i intervals, inconsistent=%p → %s',
    (n, inconsistent, expected) => {
      expect(confidenceFor(n, inconsistent)).toBe(expected);
    }
  );
});

describe('predictNextPlucking (CALC-005/006, AC-PD-002/004)', () => {
  it('uses the median interval from the last valid date, with explanation data', () => {
    // intervals 59, 61, 62, 63 → median 61.5 → estimate = 2026-07-28 + 62 (rounded)
    const p = predictNextPlucking([
      h('2026-01-01'),
      h('2026-03-01'),
      h('2026-05-01'),
      h('2026-07-02'),
      h('2026-09-03'),
    ]);
    expect(p).toMatchObject({
      methodVersion: METHOD_VERSION,
      intervalCount: 4,
      harvestCount: 5,
      lastHarvestDate: '2026-09-03',
      medianIntervalDays: 61.5,
      confidence: 'MEDIUM',
      highlyInconsistent: false,
    });
    expect(p.estimateDate).toBe('2026-11-04');
    expect(p.windowStart! < p.estimateDate!).toBe(true);
    expect(p.windowEnd! > p.estimateDate!).toBe(true);
  });

  it('downgrades confidence for highly inconsistent intervals', () => {
    // intervals 20, 100, 30, 90 → CV well above the threshold
    const p = predictNextPlucking([
      h('2026-01-01'),
      h('2026-01-21'),
      h('2026-05-01'),
      h('2026-05-31'),
      h('2026-08-29'),
    ]);
    expect(p.variability!).toBeGreaterThan(CV_THRESHOLD);
    expect(p.highlyInconsistent).toBe(true);
    expect(p.confidence).toBe('LOW'); // MEDIUM (4 intervals) downgraded
  });

  it('says "not enough history" with fewer than two valid dates (AC-PD-005)', () => {
    expect(predictNextPlucking([h('2026-01-01')])).toMatchObject({
      confidence: 'NO_PREDICTION',
      estimateDate: null,
      harvestCount: 1,
      lastHarvestDate: '2026-01-01',
    });
    expect(predictNextPlucking([])).toMatchObject({
      confidence: 'NO_PREDICTION',
      lastHarvestDate: null,
    });
  });

  it('a single interval is LOW confidence but still estimated', () => {
    const p = predictNextPlucking([h('2026-01-01'), h('2026-03-02')]);
    expect(p).toMatchObject({
      confidence: 'LOW',
      intervalCount: 1,
      medianIntervalDays: 60,
      estimateDate: '2026-05-01',
    });
  });

  it('is deterministic', () => {
    const input = [h('2026-01-01'), h('2026-03-01'), h('2026-05-02')];
    expect(predictNextPlucking(input)).toEqual(
      predictNextPlucking([...input].reverse())
    );
  });
});

describe('due-soon buckets (§10.2)', () => {
  const p = { windowStart: '2026-11-01', windowEnd: '2026-11-07' };
  it.each([
    ['2026-11-08', 'OVERDUE'],
    ['2026-11-03', 'DUE_SOON'],
    ['2026-10-25', 'DUE_SOON'],
    ['2026-10-24', 'UPCOMING'],
  ] as const)('%s → %s', (today, bucket) => {
    expect(dueBucket(p, today)).toBe(bucket);
  });
  it('no window → NOT_ENOUGH_HISTORY', () => {
    expect(
      dueBucket({ windowStart: null, windowEnd: null }, '2026-11-01')
    ).toBe('NOT_ENOUGH_HISTORY');
  });
});
