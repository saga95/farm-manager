import type { Entitlement } from './entitlements';

export type RbacStatus = 'ACTIVE' | 'ARCHIVED';

/** Tenant data: a named bundle of entitlements. */
export interface RoleRecord {
  id: string;
  name: string;
  entitlements: readonly Entitlement[];
  /** Seeded system default (cannot be hard-deleted; can be cloned/edited). */
  isSystem: boolean;
  status: RbacStatus;
}

/** Tenant data: what a member is assigned; aggregates roles. */
export interface ProfileRecord {
  id: string;
  name: string;
  roleIds: readonly string[];
  isSystem: boolean;
  status: RbacStatus;
}

export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

export interface MemberRecord {
  userId: string;
  profileId: string;
  status: MemberStatus;
}

/** Lookup tables for one tenant's RBAC data. */
export interface TenantRbac {
  roles: ReadonlyMap<string, RoleRecord>;
  profiles: ReadonlyMap<string, ProfileRecord>;
}

export type RbacErrorCode =
  | 'NOT_A_MEMBER'
  | 'MEMBER_INACTIVE'
  | 'PROFILE_INACTIVE'
  | 'FORBIDDEN'
  | 'LOCKOUT'
  | 'ESCALATION'
  | 'SYSTEM_PROFILE_PROTECTED'
  | 'UNKNOWN_ENTITLEMENT'
  | 'UNKNOWN_ROLE';

export class RbacError extends Error {
  constructor(
    public readonly code: RbacErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RbacError';
  }
}
