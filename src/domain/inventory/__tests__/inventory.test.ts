import { balance, txnIds } from '..';

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
