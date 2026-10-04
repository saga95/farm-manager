import { StockError, applyTxn, balance, reasonRequired, txnIds } from '..';

describe('produce balance (CALC-010, §41.9)', () => {
  it('stock-in minus stock-out (AC-IN-001)', () => {
    expect(
      balance([
        { type: 'HARVEST_IN', quantity: 120 },
        { type: 'HOUSEHOLD_USE', quantity: 5 },
        { type: 'DAMAGE', quantity: 2 },
      ]).total
    ).toBe(113);
  });

  it('operational dehusking conserves the total (AC-DH-002)', () => {
    const b = balance([
      { type: 'HARVEST_IN', quantity: 120 },
      {
        type: 'PROCESSING',
        quantity: 30,
        fromState: 'HUSKED',
        toState: 'DEHUSKED',
      },
    ]);
    expect(b).toEqual({ total: 120, byState: { HUSKED: 90, DEHUSKED: 30 } });
  });

  it('selling dehusked nuts reduces only that state (AC-DH-003)', () => {
    const b = balance([
      { type: 'HARVEST_IN', quantity: 120 },
      {
        type: 'PROCESSING',
        quantity: 30,
        fromState: 'HUSKED',
        toState: 'DEHUSKED',
      },
      { type: 'SALE_OUT', quantity: 4, state: 'DEHUSKED' },
    ]);
    expect(b).toEqual({ total: 116, byState: { HUSKED: 90, DEHUSKED: 26 } });
  });

  it('uses deterministic ids per cause (ADR-0004)', () => {
    expect(txnIds.roundHarvestIn('R1')).toBe('HARVEST_IN#ROUND#R1');
    expect(txnIds.saleOut('S', 'B', 'DEHUSKED')).toBe('SALE_OUT#S#B#DEHUSKED');
  });
});

describe('applyTxn: stock movements (#77, #78)', () => {
  const start = { HUSKED: 120, DEHUSKED: 0 };

  it('AC-DH-002: dehusking 30 of 120 → 90 husked + 30 dehusked, total conserved', () => {
    const next = applyTxn(start, {
      type: 'PROCESSING',
      quantity: 30,
      fromState: 'HUSKED',
      toState: 'DEHUSKED',
    });
    expect(next).toEqual({ HUSKED: 90, DEHUSKED: 30 });
    expect(next.HUSKED + next.DEHUSKED).toBe(120);
  });

  it('AC-IN-003: household use reduces stock of the chosen state', () => {
    expect(
      applyTxn(start, { type: 'HOUSEHOLD_USE', quantity: 5, state: 'HUSKED' })
    ).toEqual({ HUSKED: 115, DEHUSKED: 0 });
  });

  it('AC-IN-002: never silently below zero', () => {
    expect(() =>
      applyTxn(start, { type: 'DAMAGE', quantity: 1, state: 'DEHUSKED' })
    ).toThrow(StockError);
    expect(() =>
      applyTxn(start, {
        type: 'PROCESSING',
        quantity: 121,
        fromState: 'HUSKED',
        toState: 'DEHUSKED',
      })
    ).toThrow(/Only 120 husked/);
  });

  it('AC-IN-004: adjustments need a reason; other movements do not', () => {
    expect(reasonRequired('ADJUSTMENT_OUT')).toBe(true);
    expect(reasonRequired('ADJUSTMENT_IN')).toBe(true);
    expect(reasonRequired('WASTE')).toBe(false);
  });
});
