import {
  coconutInsights,
  cropHarvests,
  monthlyYield,
  monthsIn,
  roundStats,
  salesSummary,
  sampleDistribution,
  stockAdjustments,
  treeStats,
} from '..';

const year = { from: '2026-01-01', to: '2026-12-31' };
const h = (date: string, quantity: number | null, extra = {}) => ({
  treeId: 't1',
  roundId: `r-${date}`,
  harvestDate: date,
  quantity,
  ...extra,
});

describe('periods', () => {
  it('lists every month so empty months show as zero', () => {
    expect(monthsIn({ from: '2025-11-15', to: '2026-02-03' })).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(
      monthlyYield([h('2026-03-02', 20)], {
        from: '2026-02-01',
        to: '2026-04-30',
      })
    ).toEqual([
      { month: '2026-02', value: 0, count: 0 },
      { month: '2026-03', value: 20, count: 1 },
      { month: '2026-04', value: 0, count: 0 },
    ]);
  });
});

describe('tree statistics (§17.1, CALC-002/003/005)', () => {
  const harvests = [
    h('2026-01-10', 20),
    h('2026-03-12', 24),
    h('2026-05-11', 18),
    h('2026-07-12', 22),
    h('2026-08-01', null),
  ];
  it('totals, average, best, last, median interval; missing quantities are not zeros', () => {
    const s = treeStats(
      { id: 't1', code: 'C-001', status: 'PRODUCING' },
      harvests,
      [],
      { from: '2026-03-01', to: '2026-12-31' },
      '2026-09-21'
    );
    expect(s).toMatchObject({
      periodNuts: 64,
      periodHarvests: 3,
      lifetimeNuts: 84,
      harvestCount: 4,
      average: 21,
      best: 24,
      lastPlucked: '2026-07-12',
      daysSinceLast: 71,
      medianInterval: 61,
      latestSampleSize: null,
    });
  });

  it('a tree with no records has nulls, never zero averages', () => {
    const s = treeStats(
      { id: 't2', code: 'C-002', status: 'PRODUCING' },
      [],
      [],
      year,
      '2026-09-21'
    );
    expect(s).toMatchObject({
      average: null,
      best: null,
      lastPlucked: null,
      medianInterval: null,
      lifetimeNuts: 0,
    });
  });
});

describe('insights follow §17.6 (facts, never "poor")', () => {
  const tree = (code: string, harvests: ReturnType<typeof h>[]) =>
    treeStats(
      { id: code, code, status: 'PRODUCING' },
      harvests,
      [],
      year,
      '2026-09-21'
    );
  it('top averages, overdue against own median, and no recent record', () => {
    const insights = coconutInsights([
      tree('C-014', [
        h('2026-01-10', 20),
        h('2026-03-12', 24),
        h('2026-05-11', 22),
        h('2026-07-12', 22),
      ]),
      tree('C-020', []),
    ]);
    expect(insights).toEqual([
      { kind: 'TOP_AVERAGE', code: 'C-014', average: 22, harvests: 4 },
      {
        kind: 'OVERDUE_VS_MEDIAN',
        code: 'C-014',
        days: 71,
        medianInterval: 61,
      },
      { kind: 'NO_RECENT_RECORD', code: 'C-020', days: null },
    ]);
    expect(JSON.stringify(insights)).not.toMatch(/poor|disease|fertili/i);
  });

  it('non-producing trees are left out by default', () => {
    const s = treeStats(
      { id: 'x', code: 'C-030', status: 'YOUNG' },
      [],
      [],
      year,
      '2026-09-21'
    );
    expect(coconutInsights([s])).toEqual([]);
  });
});

describe('rounds (§17.2) and samples (CALC-009)', () => {
  it('averages over complete, non-deleted rounds in the period', () => {
    const rounds = [
      {
        id: 'a',
        roundDate: '2026-03-01',
        status: 'COMPLETE',
        totalNuts: 75,
        unattributedQuantity: 40,
      },
      { id: 'b', roundDate: '2026-05-01', status: 'COMPLETE', totalNuts: 30 },
      { id: 'c', roundDate: '2026-06-01', status: 'IN_PROGRESS', totalNuts: 0 },
      {
        id: 'd',
        roundDate: '2026-07-01',
        status: 'COMPLETE',
        totalNuts: 99,
        deletedAt: 'x',
      },
    ];
    const harvests = [
      { treeId: 't1', roundId: 'a', harvestDate: '2026-03-01', quantity: 20 },
      { treeId: 't2', roundId: 'a', harvestDate: '2026-03-01', quantity: 15 },
      { treeId: 't1', roundId: 'b', harvestDate: '2026-05-01', quantity: 30 },
    ];
    expect(roundStats(rounds, harvests, year)).toEqual({
      rounds: 2,
      totalNuts: 105,
      avgTreesPerRound: 1.5,
      avgNutsPerRound: 52.5,
      avgNutsPerTree: 21.7,
    });
  });

  it('size distribution counts samples, not coconuts', () => {
    const samples = [
      { treeId: 't1', sampledAt: '2026-03-01', sizeClass: 'LARGE' as const },
      { treeId: 't2', sampledAt: '2026-03-01', sizeClass: 'LARGE' as const },
      { treeId: 't1', sampledAt: '2025-03-01', sizeClass: 'SMALL' as const },
    ];
    expect(sampleDistribution(samples, year)).toEqual({
      counts: { SMALL: 0, MEDIUM: 0, LARGE: 2, UNCLASSIFIED: 0 },
      samples: 2,
    });
  });
});

describe('sales (§17.3, CALC-014)', () => {
  const sale = (date: string, extra = {}) => ({
    saleDate: date,
    buyerId: 'b1',
    buyerName: 'Restaurant',
    cropCode: 'COCONUT',
    quantityUnit: 'NUT',
    totalQuantity: 20,
    calculatedAmount: 2480,
    actualAmountReceived: 2400,
    lines: [
      { sizeClass: 'MEDIUM', quantity: 16, lineAmount: 1920 },
      { sizeClass: 'LARGE', quantity: 4, lineAmount: 560 },
    ],
    ...extra,
  });
  it('keeps calculated and actual apart; realized per coconut states its scope', () => {
    const s = salesSummary(
      [
        sale('2026-03-01'),
        sale('2026-04-01', { actualAmountReceived: null }),
        sale('2026-04-02', {
          cropCode: 'CUCUMBER',
          quantityUnit: 'KG',
          totalQuantity: 10.5,
          calculatedAmount: 5040,
          actualAmountReceived: 5000,
          lines: [{ sizeClass: null, quantity: 10.5, lineAmount: 5040 }],
        }),
        sale('2026-04-03', { deletedAt: 'x' }),
      ],
      year
    );
    expect(s).toMatchObject({
      sales: 3,
      calculated: 10000,
      actual: 7400,
      difference: -120,
      salesWithActual: 2,
    });
    expect(s.realizedPerCoconut).toEqual({ value: 120, sales: 1, nuts: 20 });
    expect(s.bySize).toEqual([
      { sizeClass: 'MEDIUM', quantity: 32, amount: 3840 },
      { sizeClass: 'LARGE', quantity: 8, amount: 1120 },
    ]);
    expect(s.byCrop).toEqual([
      { cropCode: 'COCONUT', unit: 'NUT', quantity: 40, calculated: 4960 },
      { cropCode: 'CUCUMBER', unit: 'KG', quantity: 10.5, calculated: 5040 },
    ]);
    expect(s.byMonth.find(m => m.month === '2026-04')).toMatchObject({
      calculated: 7520,
      actual: 5000,
    });
  });

  it('no actual amounts → no realized figure', () => {
    expect(
      salesSummary([sale('2026-03-01', { actualAmountReceived: null })], year)
        .realizedPerCoconut
    ).toBeNull();
  });
});

describe('stock and crops (§17.4, §17.5)', () => {
  it('sums use, damage, waste and adjustments by type and crop', () => {
    expect(
      stockAdjustments(
        [
          {
            transactionType: 'HOUSEHOLD_USE',
            quantity: 5,
            transactionDate: '2026-03-01',
          },
          {
            transactionType: 'HOUSEHOLD_USE',
            quantity: 2,
            transactionDate: '2026-03-05',
          },
          {
            transactionType: 'SALE_OUT',
            quantity: 20,
            transactionDate: '2026-03-05',
          },
          {
            transactionType: 'WASTE',
            quantity: 1.25,
            transactionDate: '2026-03-05',
            cropCode: 'CUCUMBER',
            unit: 'KG',
          },
        ],
        year
      )
    ).toEqual([
      {
        transactionType: 'HOUSEHOLD_USE',
        cropCode: 'COCONUT',
        unit: 'NUT',
        quantity: 7,
        count: 2,
      },
      {
        transactionType: 'WASTE',
        cropCode: 'CUCUMBER',
        unit: 'KG',
        quantity: 1.25,
        count: 1,
      },
    ]);
  });

  it('harvest by crop, unit and month', () => {
    const [c] = cropHarvests(
      [
        {
          cropCode: 'CUCUMBER',
          cropName: 'Cucumber',
          harvestDate: '2026-04-10',
          quantity: 12.5,
          unit: 'KG',
        },
        {
          cropCode: 'CUCUMBER',
          cropName: 'Cucumber',
          harvestDate: '2026-04-14',
          quantity: 8.25,
          unit: 'KG',
        },
      ],
      { from: '2026-03-01', to: '2026-04-30' }
    );
    expect(c).toMatchObject({
      cropName: 'Cucumber',
      unit: 'KG',
      total: 20.75,
      byMonth: { '2026-03': 0, '2026-04': 20.75 },
    });
  });
});
