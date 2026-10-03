import {
  SYSTEM_CROPS,
  compareTreeCodes,
  generateTreeCodes,
  isValidTreeCode,
  normalizeTreeCode,
} from '..';

describe('tree codes (Q-001)', () => {
  it('generates C-001…C-050 by default width', () => {
    const codes = generateTreeCodes({
      prefix: SYSTEM_CROPS.COCONUT.codePrefix!,
      start: 1,
      count: 50,
    });
    expect(codes).toHaveLength(50);
    expect(codes[0]).toBe('C-001');
    expect(codes[49]).toBe('C-050');
  });

  it('supports plain numbers and other prefixes', () => {
    expect(
      generateTreeCodes({ prefix: '', start: 1, count: 2, width: 2 })
    ).toEqual(['01', '02']);
    expect(generateTreeCodes({ prefix: 'p', start: 9, count: 2 })).toEqual([
      'P-009',
      'P-010',
    ]);
  });

  it('rejects invalid ranges', () => {
    expect(() =>
      generateTreeCodes({ prefix: 'C', start: 1, count: 0 })
    ).toThrow(RangeError);
    expect(() =>
      generateTreeCodes({ prefix: 'C', start: 1, count: 501 })
    ).toThrow(RangeError);
    expect(() =>
      generateTreeCodes({ prefix: 'C', start: -1, count: 1 })
    ).toThrow(RangeError);
  });

  it('normalises and validates user-entered codes', () => {
    expect(normalizeTreeCode(' c 12 ')).toBe('C-12');
    expect(isValidTreeCode('C-012')).toBe(true);
    expect(isValidTreeCode('C-')).toBe(false);
    expect(isValidTreeCode('C#1')).toBe(false);
    expect(isValidTreeCode('')).toBe(false);
  });

  it('sorts codes naturally', () => {
    expect(['C-10', 'C-2', 'C-1'].sort(compareTreeCodes)).toEqual([
      'C-1',
      'C-2',
      'C-10',
    ]);
  });
});

describe('crop catalogue (§6.1)', () => {
  it('tracks coconut as permanent individual trees counted in nuts', () => {
    expect(SYSTEM_CROPS.COCONUT).toMatchObject({
      trackingStrategy: 'PERMANENT_INDIVIDUAL',
      defaultHarvestUnit: 'NUT',
    });
  });
});
