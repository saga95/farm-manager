import { SPACE_TYPES, ZONE_TYPES, calculateAreaSqM, convertArea } from '..';

describe('farm domain', () => {
  it('lists the §41.2 space types and §4.5 zone types', () => {
    expect(SPACE_TYPES).toContain('NARROW_STRIP');
    expect(SPACE_TYPES).toContain('UNDER_TREE');
    expect(ZONE_TYPES).toEqual(
      expect.arrayContaining(['COCONUT_AREA', 'POLYTUNNEL', 'BACKYARD'])
    );
  });

  it('calculates rectangular area in m²', () => {
    expect(calculateAreaSqM(1.2, 8)).toBe(9.6); // persona: "Back strip" 1.2 × 8 m
    expect(calculateAreaSqM(10, 10, 'FT')).toBe(9.29);
  });

  it('returns null without both positive dimensions (missing ≠ zero, PR-007)', () => {
    expect(calculateAreaSqM(null, 8)).toBeNull();
    expect(calculateAreaSqM(0, 8)).toBeNull();
    expect(calculateAreaSqM(-1, 8)).toBeNull();
  });

  it('converts area units, including perches', () => {
    expect(convertArea(1, 'ACRE', 'PERCH')).toBeCloseTo(160, 0);
    expect(convertArea(1, 'HECTARE', 'SQ_M')).toBe(10_000);
  });
});
