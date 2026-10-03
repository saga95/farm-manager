/**
 * Resolution: member → profile → roles → entitlements (ADR-0001 §3).
 * Pure; the server loads the records and calls these functions per request.
 */

import type { Entitlement } from './entitlements';
import { type MemberRecord, RbacError, type TenantRbac } from './types';

export function entitlementsForRoleIds(
  rbac: TenantRbac,
  roleIds: readonly string[]
): Set<Entitlement> {
  const result = new Set<Entitlement>();
  for (const id of roleIds) {
    const role = rbac.roles.get(id);
    if (!role || role.status !== 'ACTIVE') continue; // archived/missing roles grant nothing
    role.entitlements.forEach(e => result.add(e));
  }
  return result;
}

export function entitlementsForProfile(
  rbac: TenantRbac,
  profileId: string
): Set<Entitlement> {
  const profile = rbac.profiles.get(profileId);
  if (!profile || profile.status !== 'ACTIVE') return new Set();
  return entitlementsForRoleIds(rbac, profile.roleIds);
}

/**
 * Resolve a member's effective entitlements.
 * Throws for non-members and inactive members/profiles so callers cannot
 * accidentally treat "no access" as an empty-but-valid session.
 */
export function resolveMemberEntitlements(
  rbac: TenantRbac,
  member: MemberRecord | undefined
): Set<Entitlement> {
  if (!member)
    throw new RbacError('NOT_A_MEMBER', 'User is not a member of this tenant');
  if (member.status !== 'ACTIVE')
    throw new RbacError('MEMBER_INACTIVE', 'Membership is not active');
  const profile = rbac.profiles.get(member.profileId);
  if (!profile || profile.status !== 'ACTIVE') {
    throw new RbacError(
      'PROFILE_INACTIVE',
      'Assigned profile is missing or archived'
    );
  }
  return entitlementsForRoleIds(rbac, profile.roleIds);
}

export function hasEntitlement(
  granted: ReadonlySet<Entitlement>,
  required: Entitlement
): boolean {
  return granted.has(required);
}

/** Server guard: throws FORBIDDEN unless `required` is granted. */
export function requireEntitlement(
  granted: ReadonlySet<Entitlement>,
  required: Entitlement
): void {
  if (!granted.has(required)) {
    throw new RbacError('FORBIDDEN', `Missing entitlement: ${required}`);
  }
}
