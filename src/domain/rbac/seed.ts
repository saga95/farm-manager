import { DEFAULT_PROFILES, DEFAULT_ROLES } from './defaults';
import type { ProfileRecord, RoleRecord, TenantRbac } from './types';

/** Build lookup maps from stored role/profile records. */
export function buildTenantRbac(
  roles: readonly RoleRecord[],
  profiles: readonly ProfileRecord[]
): TenantRbac {
  return {
    roles: new Map(roles.map(r => [r.id, r])),
    profiles: new Map(profiles.map(p => [p.id, p])),
  };
}

/** Records to write when a tenant is created (ADR-0001 §8). Returns fresh copies. */
export function seedDefaultRbac(): {
  roles: RoleRecord[];
  profiles: ProfileRecord[];
} {
  return {
    roles: DEFAULT_ROLES.map(r => ({
      ...r,
      entitlements: [...r.entitlements],
    })),
    profiles: DEFAULT_PROFILES.map(p => ({ ...p, roleIds: [...p.roleIds] })),
  };
}
