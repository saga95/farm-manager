import {
  allocationDelta,
  autoAllocate,
  calculatedAmount,
  lineAmount,
  mergeAllocations,
  normalizeSizePrefs,
  saleTotals,
  validateSale,
} from '..';

describe('buyer size preferences (§13.2, AC-SL-001)', () => {
  it('stores preferred Medium and acceptable Large', () => {
    expect(normalizeSizePrefs(['MEDIUM'], ['LARGE'])).toEqual({
      preferredSizes: ['MEDIUM'],
      acceptableSizes: ['LARGE'],
    });
  });
  it('a size is never both preferred and acceptable; unknown sizes dropped; ordered', () => {
    expect(
      normalizeSizePrefs(['LARGE', 'SMALL', 'LARGE'], ['LARGE', 'MEDIUM', 'XL'])
    ).toEqual({
      preferredSizes: ['SMALL', 'LARGE'],
      acceptableSizes: ['MEDIUM'],
    });
  });
});

describe('sale calculations (CALC-011..013, DQ-009)', () => {
  // §13.4 example
  const lines = [
    { sizeClass: 'LARGE', quantity: 23, unitPrice: 140 },
    { sizeClass: 'MEDIUM', quantity: 16, unitPrice: 120 },
    { sizeClass: 'MEDIUM', quantity: 14, unitPrice: 110 },
    { sizeClass: 'SMALL', quantity: 7, unitPrice: 100 },
  ];

  it('CALC-011: line amount = quantity × price', () => {
    expect(lineAmount(lines[0]!)).toBe(3220);
    expect(lineAmount({ quantity: 3, unitPrice: 0.1 })).toBe(0.3);
  });

  it('CALC-012: calculated total = Σ lines (the SRS example: 7,380)', () => {
    expect(calculatedAmount(lines)).toBe(3220 + 1920 + 1540 + 700);
  });

  it('CALC-013 / AC-SL-004/005: actual is kept separately and the difference preserved', () => {
    expect(saleTotals(lines, 7800)).toEqual({
      totalQuantity: 60,
      calculatedAmount: 7380,
      actualAmountReceived: 7800,
      difference: 420,
    });
    expect(saleTotals(lines).difference).toBeNull();
  });
});

describe('stock allocation (§13.5)', () => {
  it('sold quantity must equal the allocated quantity', () => {
    expect(validateSale([], [])).toEqual({ code: 'NO_LINES' });
    expect(
      validateSale(
        [{ quantity: 10, unitPrice: 100 }],
        [{ batchId: 'b1', state: 'HUSKED', quantity: 8 }]
      )
    ).toEqual({ code: 'ALLOCATION_MISMATCH', sold: 10, allocated: 8 });
    expect(
      validateSale(
        [{ quantity: 10, unitPrice: 100 }],
        [
          { batchId: 'b1', state: 'HUSKED', quantity: 6 },
          { batchId: 'b2', state: 'DEHUSKED', quantity: 4 },
        ]
      )
    ).toBeNull();
  });

  it('merges duplicates and computes edit deltas per batch + state (#88)', () => {
    expect(
      mergeAllocations([
        { batchId: 'b1', state: 'HUSKED', quantity: 3 },
        { batchId: 'b1', state: 'HUSKED', quantity: 2 },
      ])
    ).toEqual([{ batchId: 'b1', state: 'HUSKED', quantity: 5 }]);
    expect(
      allocationDelta(
        [{ batchId: 'b1', state: 'HUSKED', quantity: 10 }],
        [
          { batchId: 'b1', state: 'HUSKED', quantity: 7 },
          { batchId: 'b2', state: 'HUSKED', quantity: 5 },
        ]
      )
    ).toEqual([
      { batchId: 'b1', state: 'HUSKED', quantity: -3 },
      { batchId: 'b2', state: 'HUSKED', quantity: 5 },
    ]);
  });
});

describe('autoAllocate (FIFO suggestion)', () => {
  const batches = [
    {
      batchId: 'new',
      batchDate: '2026-10-03',
      available: { HUSKED: 50, DEHUSKED: 0 },
    },
    {
      batchId: 'old',
      batchDate: '2026-10-01',
      available: { HUSKED: 30, DEHUSKED: 10 },
    },
  ];
  it('takes the oldest stock first', () => {
    expect(autoAllocate(40, batches, 'HUSKED')).toEqual({
      allocations: [
        { batchId: 'old', state: 'HUSKED', quantity: 30 },
        { batchId: 'new', state: 'HUSKED', quantity: 10 },
      ],
      short: 0,
    });
  });
  it('reports a shortfall instead of overselling', () => {
    expect(autoAllocate(12, batches, 'DEHUSKED')).toEqual({
      allocations: [{ batchId: 'old', state: 'DEHUSKED', quantity: 10 }],
      short: 2,
    });
  });
});
