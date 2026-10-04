import { type SampleLike, type SizeClass, sizeHistory, suggestsSize } from '..';

const s = (
  sampledAt: string,
  sizeClass: SizeClass,
  deletedAt?: string
): SampleLike => ({
  sampledAt,
  sizeClass,
  ...(deletedAt ? { deletedAt } : {}),
});

describe('sizeHistory (§9.4, CALC-008/009)', () => {
  it('AC-SM-003: L, L, M, L, L → four Large and one Medium; tendency Large (4 of 5)', () => {
    const h = sizeHistory([
      s('2026-01-01', 'LARGE'),
      s('2026-03-01', 'LARGE'),
      s('2026-05-01', 'MEDIUM'),
      s('2026-07-01', 'LARGE'),
      s('2026-09-01', 'LARGE'),
    ]);
    expect(h.counts).toEqual({
      SMALL: 0,
      MEDIUM: 1,
      LARGE: 4,
      UNCLASSIFIED: 0,
    });
    expect(h).toMatchObject({
      sampleCount: 5,
      latest: 'LARGE',
      latestDate: '2026-09-01',
      tendency: 'LARGE',
      tendencyMatches: 4,
    });
    expect(h.recent).toEqual(['LARGE', 'LARGE', 'MEDIUM', 'LARGE', 'LARGE']);
  });

  it('AC-SM-005: never sampled → latest null (not assumed from anything)', () => {
    expect(sizeHistory([])).toMatchObject({
      latest: null,
      sampleCount: 0,
      tendency: null,
    });
  });

  it('UNCLASSIFIED is a sample without a size: counted, but no size evidence', () => {
    const h = sizeHistory([s('2026-01-01', 'UNCLASSIFIED')]);
    expect(h).toMatchObject({
      latest: 'UNCLASSIFIED',
      sampleCount: 1,
      tendency: null,
    });
  });

  it('no tendency with fewer than 3 classified recent samples, or a tie', () => {
    expect(
      sizeHistory([s('2026-01-01', 'MEDIUM'), s('2026-02-01', 'MEDIUM')])
        .tendency
    ).toBeNull();
    expect(
      sizeHistory([
        s('2026-01-01', 'SMALL'),
        s('2026-02-01', 'SMALL'),
        s('2026-03-01', 'LARGE'),
        s('2026-04-01', 'LARGE'),
      ]).tendency
    ).toBeNull();
  });

  it('only the 5 most recent samples drive the tendency; deleted samples are ignored', () => {
    const h = sizeHistory([
      s('2025-01-01', 'SMALL'),
      s('2025-02-01', 'SMALL'),
      s('2025-03-01', 'SMALL'),
      s('2026-01-01', 'MEDIUM'),
      s('2026-02-01', 'MEDIUM'),
      s('2026-03-01', 'MEDIUM'),
      s('2026-04-01', 'LARGE', 'deleted'),
    ]);
    expect(h.tendency).toBe('MEDIUM');
    expect(h.latest).toBe('MEDIUM');
    expect(h.counts.SMALL).toBe(3); // full history still counted
  });
});

describe('suggestsSize (US-011 buyer matching)', () => {
  it('matches latest or tendency', () => {
    expect(suggestsSize({ latest: 'MEDIUM', tendency: null }, 'MEDIUM')).toBe(
      true
    );
    expect(
      suggestsSize({ latest: 'SMALL', tendency: 'MEDIUM' }, 'MEDIUM')
    ).toBe(true);
    expect(suggestsSize({ latest: null, tendency: null }, 'MEDIUM')).toBe(
      false
    );
  });
});
