import { isUlid, keys } from '../keys';

describe('FarmData keys (ADR-0002)', () => {
  it('prefixes every tenant-owned partition with T#<tenantId>', () => {
    const tid = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
    for (const k of [
      keys.tenant(tid),
      keys.member(tid, 'user-1'),
      keys.role(tid, 'r1'),
      keys.profile(tid, 'p1'),
      keys.farm(tid, 'f1'),
      keys.audit(tid, 'e1', '2026-10-03T00:00:00.000Z', 'a1'),
    ]) {
      expect(k.PK.startsWith(`T#${tid}`)).toBe(true);
    }
  });

  it('builds the documented key shapes', () => {
    expect(keys.member('t1', 'u1')).toEqual({ PK: 'T#t1', SK: 'MEMBER#u1' });
    expect(keys.memberByUser('u1', 't1')).toEqual({
      GSI1PK: 'U#u1',
      GSI1SK: 'T#t1',
    });
    expect(keys.byId('x1')).toEqual({ GSI2PK: 'ID#x1' });
  });

  it('rejects ids that could break out of their key segment', () => {
    expect(() => keys.tenant('a#b')).toThrow(/Invalid tenantId/);
    expect(() => keys.member('t1', '')).toThrow(/Invalid userId/);
  });

  it('validates ULIDs', () => {
    expect(isUlid('01J9ZQ3M5K8R2V7W4X6Y0A1B2C')).toBe(true);
    expect(isUlid('01J9ZQ3M5K8R2V7W4X6Y0A1B2')).toBe(false);
    expect(isUlid('01J9ZQ3M5K8R2V7W4X6Y0A1B2I')).toBe(false); // I is not Crockford
  });
});
