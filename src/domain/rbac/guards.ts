/**
 * Guardrails for tenant-defined roles/profiles (ADR-0001 §5, #121).
 * Each guard validates a *proposed* change before it is written.
 */

import {
  type Entitlement,
  TENANT_ADMIN_ENTITLEMENTS,
  isEntitlement,
} from './entitlements';
import { entitlementsForProfile, entitlementsForRoleIds } from './resolve';
import { SYSTEM_PROFILE_IDS } from './defaults';
import { type MemberRecord, RbacError, type TenantRbac } from './types';

/** Reject entitlement names outside the system catalogue. */
export function assertKnownEntitlements(
  entitlements: readonly string[]
): asserts entitlements is Entitlement[] {
  const unknown = entitlements.filter(e => !isEntitlement(e));
  if (unknown.length > 0) {
    throw new RbacError(
      'UNKNOWN_ENTITLEMENT',
      `Unknown entitlements: ${unknown.join(', ')}`
    );
  }
}

/** Reject role references that don't exist in this tenant. */
export function assertKnownRoles(
  rbac: TenantRbac,
  roleIds: readonly string[]
): void {
  const unknown = roleIds.filter(id => !rbac.roles.has(id));
  if (unknown.length > 0)
    throw new RbacError('UNKNOWN_ROLE', `Unknown roles: ${unknown.join(', ')}`);
}

/**
 * No escalation: an actor may only grant entitlements they hold themselves,
 * whether by editing a role, composing a profile, or assigning a profile.
 */
export function assertNoEscalation(
  actor: ReadonlySet<Entitlement>,
  granted: Iterable<Entitlement>
): void {
  const missing = [...new Set(granted)].filter(e => !actor.has(e));
  if (missing.length > 0) {
    throw new RbacError(
      'ESCALATION',
      `Cannot grant entitlements you do not hold: ${missing.join(', ')}`
    );
  }
}

/** Entitlements a role-set would grant (for escalation checks on profile edits). */
export function grantedByRoles(
  rbac: TenantRbac,
  roleIds: readonly string[]
): Set<Entitlement> {
  return entitlementsForRoleIds(rbac, roleIds);
}

/** True if this member can administer the tenant (manage tenant + members). */
function isTenantAdmin(rbac: TenantRbac, member: MemberRecord): boolean {
  if (member.status !== 'ACTIVE') return false;
  const granted = entitlementsForProfile(rbac, member.profileId);
  return TENANT_ADMIN_ENTITLEMENTS.every(e => granted.has(e));
}

/**
 * No lock-out: after the proposed change, at least one ACTIVE member must still
 * hold `tenant.manage` and `member.manage`. Pass the *resulting* state.
 */
export function assertNoLockout(
  rbacAfter: TenantRbac,
  membersAfter: readonly MemberRecord[]
): void {
  if (!membersAfter.some(m => isTenantAdmin(rbacAfter, m))) {
    throw new RbacError(
      'LOCKOUT',
      'This change would leave no active member who can manage the tenant and its members'
    );
  }
}

/** The built-in Owner profile can be edited (the lock-out guard still applies) but never deleted or archived. */
export function assertProfileDeletable(profileId: string): void {
  if (profileId === SYSTEM_PROFILE_IDS.owner) {
    throw new RbacError(
      'SYSTEM_PROFILE_PROTECTED',
      'The built-in Owner profile cannot be deleted or archived'
    );
  }
}
