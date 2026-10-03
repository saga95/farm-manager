/**
 * Entitlement catalogue: the system-defined permissions that server handlers
 * check (ADR-0001 §4). Tenants compose these into their own roles and profiles
 * but can never invent new entitlements. Adding one is a code release.
 *
 * Naming: `<area>.<action>`.
 */

export const ENTITLEMENT_CATALOGUE_VERSION = 1;

export const ENTITLEMENT_GROUPS = {
  tenant: [
    'tenant.manage',
    'member.manage',
    'role.manage',
    'profile.manage',
    'farm.manage',
  ],
  farm: ['zone.manage', 'space.manage', 'tree.manage', 'cycle.manage'],
  field: [
    'round.record',
    'harvest.record',
    'sample.record',
    'activity.record',
    'media.upload',
  ],
  stock: ['inventory.adjust', 'inventory.dehusk', 'input.manage'],
  sales: ['buyer.manage', 'sale.record'],
  records: [
    'record.edit',
    'record.archive',
    'record.restore',
    'backfill.record',
  ],
  read: ['farm.view', 'analytics.view', 'export.data', 'audit.view'],
} as const;

export type EntitlementGroup = keyof typeof ENTITLEMENT_GROUPS;
export type Entitlement = (typeof ENTITLEMENT_GROUPS)[EntitlementGroup][number];

export const ALL_ENTITLEMENTS: readonly Entitlement[] =
  Object.values(ENTITLEMENT_GROUPS).flat();

const ENTITLEMENT_SET: ReadonlySet<string> = new Set(ALL_ENTITLEMENTS);

export function isEntitlement(value: string): value is Entitlement {
  return ENTITLEMENT_SET.has(value);
}

/** Entitlements that must always be held by at least one active member (lock-out guard). */
export const TENANT_ADMIN_ENTITLEMENTS = [
  'tenant.manage',
  'member.manage',
] as const satisfies readonly Entitlement[];
