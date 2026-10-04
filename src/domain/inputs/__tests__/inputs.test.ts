import {
  InputStockError,
  applyInputTxn,
  inputBalance,
  inputReasonRequired,
  isLowStock,
} from '..';

describe('farm-input inventory (§12)', () => {
  it('quantity is the sum of stock in, out and signed adjustments', () => {
    expect(
      inputBalance([
        { type: 'STOCK_IN', quantity: 50 },
        { type: 'STOCK_OUT', quantity: 12.5 },
        { type: 'ADJUSTMENT', quantity: -0.5 },
        { type: 'ADJUSTMENT', quantity: 2 },
      ])
    ).toBe(39);
  });

  it('keeps decimals exact enough for kg and litres', () => {
    expect(
      inputBalance([
        { type: 'STOCK_IN', quantity: 0.1 },
        { type: 'STOCK_IN', quantity: 0.2 },
      ])
    ).toBe(0.3);
  });

  it('never goes below zero', () => {
    expect(applyInputTxn(5, { type: 'STOCK_OUT', quantity: 5 })).toBe(0);
    expect(() =>
      applyInputTxn(5, { type: 'STOCK_OUT', quantity: 5.5 })
    ).toThrow(InputStockError);
    expect(() =>
      applyInputTxn(1, { type: 'ADJUSTMENT', quantity: -2 })
    ).toThrow(/Only 1/);
  });

  it('low stock only when a reorder level is set (at or below it)', () => {
    expect(isLowStock(3, 5)).toBe(true);
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
    expect(isLowStock(0, null)).toBe(false);
  });

  it('adjustments need a reason', () => {
    expect(inputReasonRequired('ADJUSTMENT')).toBe(true);
    expect(inputReasonRequired('STOCK_OUT')).toBe(false);
  });
});
