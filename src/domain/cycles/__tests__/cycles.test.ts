import {
  addHarvestTotal,
  canMoveCycle,
  cropCodeOf,
  defaultCycleName,
  isValidHarvestQuantity,
  nextCycleStatuses,
} from '..';

describe('production cycle lifecycle (§6.3)', () => {
  it('moves forward, may skip steps, and can be cancelled while open', () => {
    expect(canMoveCycle('PLANNED', 'ACTIVE')).toBe(true);
    expect(canMoveCycle('PLANNED', 'HARVESTING')).toBe(true);
    expect(canMoveCycle('HARVESTING', 'COMPLETED')).toBe(true);
    expect(canMoveCycle('ACTIVE', 'CANCELLED')).toBe(true);
    expect(canMoveCycle('HARVESTING', 'ACTIVE')).toBe(false);
  });

  it('a completed cycle can reopen for a late harvest; cancelled is final', () => {
    expect(nextCycleStatuses('COMPLETED')).toEqual(['HARVESTING']);
    expect(nextCycleStatuses('CANCELLED')).toEqual([]);
    expect(nextCycleStatuses('PLANNED')).toEqual([
      'ACTIVE',
      'HARVESTING',
      'COMPLETED',
      'CANCELLED',
    ]);
  });
});

describe('crop codes and names', () => {
  it('derives a stable code from a free-text crop name', () => {
    expect(cropCodeOf('Ginger')).toBe('GINGER');
    expect(cropCodeOf(' Bell pepper ')).toBe('BELL_PEPPER');
    expect(cropCodeOf('Chilli (MI-2)')).toBe('CHILLI_MI_2');
    expect(cropCodeOf('###')).toBe('OTHER');
  });

  it('names a cycle by crop and month', () => {
    expect(defaultCycleName('Ginger', '2026-01-15')).toBe('Ginger 2026-01');
  });
});

describe('harvest quantities (§14.2, AC-PT-003)', () => {
  it('weights allow decimals; counts are whole', () => {
    expect(isValidHarvestQuantity(12.5, 'KG')).toBe(true);
    expect(isValidHarvestQuantity(12.5555, 'KG')).toBe(false);
    expect(isValidHarvestQuantity(12.5, 'COUNT')).toBe(false);
    expect(isValidHarvestQuantity(0, 'KG')).toBe(false);
  });
  it('keeps running totals per unit (AC-PC-003)', () => {
    expect(addHarvestTotal(addHarvestTotal({}, 'KG', 12.5), 'KG', 0.1)).toEqual(
      { KG: 12.6 }
    );
  });
});
