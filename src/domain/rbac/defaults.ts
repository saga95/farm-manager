/**
 * System default roles and profiles seeded into every new tenant (#121).
 * Tenants may clone, rename and edit them; OWNER cannot be deleted.
 * IDs are stable so seeding is idempotent and migrations can target them.
 */

import { ALL_ENTITLEMENTS, type Entitlement } from './entitlements';
import type { ProfileRecord, RoleRecord } from './types';

const role = (
  id: string,
  name: string,
  entitlements: readonly Entitlement[]
): RoleRecord => ({
  id,
  name,
  entitlements,
  isSystem: true,
  status: 'ACTIVE',
});

export const SYSTEM_ROLE_IDS = {
  tenantAdmin: 'sys-role-tenant-admin',
  farmManager: 'sys-role-farm-manager',
  fieldCapture: 'sys-role-field-capture',
  stockKeeper: 'sys-role-stock-keeper',
  salesClerk: 'sys-role-sales-clerk',
  recordEditor: 'sys-role-record-editor',
  recordAdmin: 'sys-role-record-admin',
  reader: 'sys-role-reader',
} as const;

export const SYSTEM_PROFILE_IDS = {
  owner: 'sys-profile-owner',
  member: 'sys-profile-member',
  farmHelper: 'sys-profile-farm-helper',
  viewer: 'sys-profile-viewer',
} as const;

export const DEFAULT_ROLES: readonly RoleRecord[] = [
  role(SYSTEM_ROLE_IDS.tenantAdmin, 'Tenant administration', [
    'tenant.manage',
    'member.manage',
    'role.manage',
    'profile.manage',
    'farm.manage',
  ]),
  role(SYSTEM_ROLE_IDS.farmManager, 'Farm setup', [
    'zone.manage',
    'space.manage',
    'tree.manage',
    'cycle.manage',
  ]),
  role(SYSTEM_ROLE_IDS.fieldCapture, 'Field capture', [
    'round.record',
    'harvest.record',
    'sample.record',
    'activity.record',
    'media.upload',
  ]),
  role(SYSTEM_ROLE_IDS.stockKeeper, 'Stock keeping', [
    'inventory.adjust',
    'inventory.dehusk',
    'input.manage',
  ]),
  role(SYSTEM_ROLE_IDS.salesClerk, 'Sales', ['buyer.manage', 'sale.record']),
  role(SYSTEM_ROLE_IDS.recordEditor, 'Record editing', [
    'record.edit',
    'backfill.record',
  ]),
  role(SYSTEM_ROLE_IDS.recordAdmin, 'Record administration', [
    'record.archive',
    'record.restore',
    'audit.view',
  ]),
  role(SYSTEM_ROLE_IDS.reader, 'Read only', [
    'farm.view',
    'analytics.view',
    'export.data',
  ]),
];

const profile = (
  id: string,
  name: string,
  roleIds: readonly string[]
): ProfileRecord => ({
  id,
  name,
  roleIds,
  isSystem: true,
  status: 'ACTIVE',
});

const R = SYSTEM_ROLE_IDS;

export const DEFAULT_PROFILES: readonly ProfileRecord[] = [
  // Everything (SRS §4.3 OWNER)
  profile(SYSTEM_PROFILE_IDS.owner, 'Owner', Object.values(R)),
  // Trusted operator (SRS §4.3 MEMBER): no tenant admin, no archive/restore
  profile(SYSTEM_PROFILE_IDS.member, 'Member', [
    R.farmManager,
    R.fieldCapture,
    R.stockKeeper,
    R.salesClerk,
    R.recordEditor,
    R.reader,
  ]),
  // Helper in the field (PO decision Q-008): capture + stock movements, view only otherwise
  profile(SYSTEM_PROFILE_IDS.farmHelper, 'Farm helper', [
    R.fieldCapture,
    R.stockKeeper,
    R.reader,
  ]),
  // Read only (SRS §4.3 VIEWER)
  profile(SYSTEM_PROFILE_IDS.viewer, 'Viewer', [R.reader]),
];

/** The OWNER profile must resolve to the complete catalogue. */
export const OWNER_ENTITLEMENT_COUNT = ALL_ENTITLEMENTS.length;
