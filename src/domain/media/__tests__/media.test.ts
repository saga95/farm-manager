import {
  fitWithin,
  isMediaContentType,
  keyBelongsToTenant,
  mediaObjectKeys,
} from '..';

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const base = {
  tenantId: T,
  farmId: '01J9ZQ3M5K8R2V7W4X6Y0A1B2E',
  category: 'TREE_PROFILE',
  entityType: 'TREE',
  entityId: '01J9ZQ3M5K8R2V7W4X6Y0A1B2F',
  mediaId: '01J9ZQ3M5K8R2V7W4X6Y0A1B2G',
  contentType: 'image/jpeg',
} as const;

describe('media object keys (ADR-0003 §2)', () => {
  it('builds tenant-prefixed original and thumbnail keys', () => {
    const k = mediaObjectKeys(base);
    expect(k.original).toBe(
      `tenants/${T}/farms/${base.farmId}/TREE_PROFILE/TREE/${base.entityId}/${base.mediaId}/original.jpg`
    );
    expect(k.thumb).toMatch(/\/thumb\.webp$/);
    expect(keyBelongsToTenant(k.original, T)).toBe(true);
    expect(keyBelongsToTenant(k.original, '01J9ZQ3M5K8R2V7W4X6Y0A1B2D')).toBe(
      false
    );
  });

  it('rejects path tricks in any segment', () => {
    expect(() => mediaObjectKeys({ ...base, entityId: '../other' })).toThrow();
    expect(() => mediaObjectKeys({ ...base, tenantId: 'a/b' })).toThrow();
  });

  it('knows the allowed image types', () => {
    expect(isMediaContentType('image/heic')).toBe(true);
    expect(isMediaContentType('application/pdf')).toBe(false);
    expect(isMediaContentType('toString')).toBe(false);
  });
});

describe('fitWithin (thumbnail size)', () => {
  it('scales the longest edge down to 480 and keeps the ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 480, height: 360 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 360, height: 480 });
  });
  it('never upscales', () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
  });
});
