/**
 * App shell navigation model (SRS §20, ux-docs/information-architecture).
 * Pure data + helpers so it can be unit-tested without rendering.
 */

export type NavKey = 'home' | 'farm' | 'inventory' | 'sales' | 'more';

export interface NavItem {
  key: NavKey;
  href: string;
  /** i18n key in the `shell` namespace */
  labelKey: `nav.${NavKey}`;
  /** Route prefixes that belong to this tab (besides `href`) */
  prefixes: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', href: '/', labelKey: 'nav.home', prefixes: [] },
  {
    key: 'farm',
    href: '/farm',
    labelKey: 'nav.farm',
    prefixes: ['/farm', '/coconut'],
  },
  {
    key: 'inventory',
    href: '/inventory',
    labelKey: 'nav.inventory',
    prefixes: ['/inventory'],
  },
  { key: 'sales', href: '/sales', labelKey: 'nav.sales', prefixes: ['/sales'] },
  {
    key: 'more',
    href: '/more',
    labelKey: 'nav.more',
    prefixes: ['/more', '/analytics', '/settings', '/search'],
  },
];

const matchesPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Returns the tab that owns `pathname`, or `null` for routes outside the tabs (e.g. /auth). */
export function getActiveNavKey(pathname: string): NavKey | null {
  const path = pathname.split(/[?#]/)[0] || '/';
  if (path === '/') return 'home';
  const item = NAV_ITEMS.find(i =>
    i.prefixes.some(p => matchesPrefix(path, p))
  );
  return item ? item.key : null;
}

export type QuickActionKey =
  | 'newRound'
  | 'recordHarvest'
  | 'recordSale'
  | 'inventoryMovement';

export interface QuickAction {
  key: QuickActionKey;
  href: string;
  /** i18n key in the `shell` namespace */
  labelKey: `quickActions.${QuickActionKey}`;
}

/** Persistent quick actions (SRS §16 "Prominent actions", §20). */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    key: 'newRound',
    href: '/coconut/rounds/new',
    labelKey: 'quickActions.newRound',
  },
  {
    key: 'recordHarvest',
    href: '/farm',
    labelKey: 'quickActions.recordHarvest',
  },
  {
    key: 'recordSale',
    href: '/sales/new',
    labelKey: 'quickActions.recordSale',
  },
  {
    key: 'inventoryMovement',
    href: '/inventory',
    labelKey: 'quickActions.inventoryMovement',
  },
];
