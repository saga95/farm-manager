import { NAV_ITEMS, QUICK_ACTIONS, getActiveNavKey } from '../navigation';

describe('getActiveNavKey', () => {
  it.each([
    ['/', 'home'],
    ['/farm', 'farm'],
    ['/farm/zones/z1', 'farm'],
    ['/coconut/trees/t-12', 'farm'],
    ['/coconut/rounds/r1/capture', 'farm'],
    ['/inventory', 'inventory'],
    ['/inventory/batches/b1', 'inventory'],
    ['/sales/new', 'sales'],
    ['/more', 'more'],
    ['/analytics/coconut', 'more'],
    ['/settings/members', 'more'],
    ['/search', 'more'],
    ['/sales?tab=history', 'sales'],
  ])('maps %s to %s', (path, key) => {
    expect(getActiveNavKey(path)).toBe(key);
  });

  it('returns null for routes outside the tabs', () => {
    expect(getActiveNavKey('/auth/login')).toBeNull();
    expect(getActiveNavKey('/setup')).toBeNull();
  });

  it('does not match partial segment names', () => {
    expect(getActiveNavKey('/farmers')).toBeNull();
    expect(getActiveNavKey('/salesforce')).toBeNull();
  });
});

describe('navigation config', () => {
  it('has the five SRS §20 tabs in order', () => {
    expect(NAV_ITEMS.map(i => i.key)).toEqual([
      'home',
      'farm',
      'inventory',
      'sales',
      'more',
    ]);
  });

  it('starts quick actions with the flagship plucking round', () => {
    expect(QUICK_ACTIONS[0]?.key).toBe('newRound');
    expect(QUICK_ACTIONS.map(a => a.key)).toEqual([
      'newRound',
      'recordHarvest',
      'recordSale',
      'inventoryMovement',
    ]);
  });
});
