import {
  ALL_ENTITLEMENTS,
  DEFAULT_PROFILES,
  DEFAULT_ROLES,
  type Entitlement,
  type MemberRecord,
  OWNER_ENTITLEMENT_COUNT,
  type ProfileRecord,
  RbacError,
  type RoleRecord,
  SYSTEM_PROFILE_IDS,
  SYSTEM_ROLE_IDS,
  assertKnownEntitlements,
  assertKnownRoles,
  assertNoEscalation,
  assertNoLockout,
  assertProfileDeletable,
  buildTenantRbac,
  entitlementsForProfile,
  grantedByRoles,
  isEntitlement,
  requireEntitlement,
  resolveMemberEntitlements,
  seedDefaultRbac,
} from '..';

const defaults = () => {
  const { roles, profiles } = seedDefaultRbac();
  return buildTenantRbac(roles, profiles);
};

const member = (
  userId: string,
  profileId: string,
  status: MemberRecord['status'] = 'ACTIVE'
): MemberRecord => ({
  userId,
  profileId,
  status,
});

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof RbacError ? e.code : 'OTHER';
  }
  return undefined;
};

describe('entitlement catalogue', () => {
  it('has unique, well-formed names', () => {
    expect(new Set(ALL_ENTITLEMENTS).size).toBe(ALL_ENTITLEMENTS.length);
    ALL_ENTITLEMENTS.forEach(e => expect(e).toMatch(/^[a-z]+\.[a-z]+$/));
  });

  it('recognises only catalogue entries', () => {
    expect(isEntitlement('harvest.record')).toBe(true);
    expect(isEntitlement('harvest.delete_everything')).toBe(false);
  });

  it('every default role only uses catalogue entitlements', () => {
    DEFAULT_ROLES.forEach(r =>
      expect(() => assertKnownEntitlements([...r.entitlements])).not.toThrow()
    );
  });
});

describe('default profiles (SRS §4.3 + PO decision Q-008)', () => {
  const rbac = defaults();
  const of = (id: string) => entitlementsForProfile(rbac, id);

  it('Owner holds the complete catalogue', () => {
    expect(of(SYSTEM_PROFILE_IDS.owner).size).toBe(OWNER_ENTITLEMENT_COUNT);
  });

  it('Farm helper can capture field data and move stock, but not administer', () => {
    const helper = of(SYSTEM_PROFILE_IDS.farmHelper);
    (
      [
        'round.record',
        'harvest.record',
        'sample.record',
        'media.upload',
        'inventory.adjust',
        'farm.view',
      ] as const
    ).forEach(e => expect(helper.has(e)).toBe(true));
    (
      [
        'member.manage',
        'tenant.manage',
        'record.archive',
        'role.manage',
        'sale.record',
      ] as const
    ).forEach(e => expect(helper.has(e)).toBe(false));
  });

  it('Member cannot transfer ownership, archive or manage members (US-027)', () => {
    const m = of(SYSTEM_PROFILE_IDS.member);
    expect(m.has('sale.record')).toBe(true);
    expect(m.has('record.edit')).toBe(true);
    (
      [
        'tenant.manage',
        'member.manage',
        'record.archive',
        'profile.manage',
      ] as const
    ).forEach(e => expect(m.has(e)).toBe(false));
  });

  it('Viewer is read only', () => {
    const v = of(SYSTEM_PROFILE_IDS.viewer);
    expect(
      [...v].every(e =>
        ['farm.view', 'analytics.view', 'export.data'].includes(e)
      )
    ).toBe(true);
  });

  it('seeding returns independent copies', () => {
    const a = seedDefaultRbac();
    a.roles[0]!.entitlements.length = 0;
    expect(seedDefaultRbac().roles[0]!.entitlements.length).toBeGreaterThan(0);
    expect(DEFAULT_PROFILES).toHaveLength(4);
  });
});

describe('resolution', () => {
  it('rejects non-members and inactive members', () => {
    const rbac = defaults();
    expect(codeOf(() => resolveMemberEntitlements(rbac, undefined))).toBe(
      'NOT_A_MEMBER'
    );
    expect(
      codeOf(() =>
        resolveMemberEntitlements(
          rbac,
          member('u', SYSTEM_PROFILE_IDS.owner, 'SUSPENDED')
        )
      )
    ).toBe('MEMBER_INACTIVE');
  });

  it('rejects archived or missing profiles', () => {
    const { roles, profiles } = seedDefaultRbac();
    const archived = profiles.map(p =>
      p.id === SYSTEM_PROFILE_IDS.viewer
        ? { ...p, status: 'ARCHIVED' as const }
        : p
    );
    const rbac = buildTenantRbac(roles, archived);
    expect(
      codeOf(() =>
        resolveMemberEntitlements(rbac, member('u', SYSTEM_PROFILE_IDS.viewer))
      )
    ).toBe('PROFILE_INACTIVE');
    expect(
      codeOf(() => resolveMemberEntitlements(rbac, member('u', 'nope')))
    ).toBe('PROFILE_INACTIVE');
  });

  it('ignores archived roles inside an active profile', () => {
    const { roles, profiles } = seedDefaultRbac();
    const archivedCapture = roles.map(r =>
      r.id === SYSTEM_ROLE_IDS.fieldCapture
        ? { ...r, status: 'ARCHIVED' as const }
        : r
    );
    const rbac = buildTenantRbac(archivedCapture, profiles);
    const helper = resolveMemberEntitlements(
      rbac,
      member('u', SYSTEM_PROFILE_IDS.farmHelper)
    );
    expect(helper.has('harvest.record')).toBe(false);
    expect(helper.has('farm.view')).toBe(true);
  });

  it('requireEntitlement throws FORBIDDEN when missing', () => {
    const granted = new Set<Entitlement>(['farm.view']);
    expect(() => requireEntitlement(granted, 'farm.view')).not.toThrow();
    expect(codeOf(() => requireEntitlement(granted, 'sale.record'))).toBe(
      'FORBIDDEN'
    );
  });
});

describe('tenant-defined profiles (#121)', () => {
  it('a custom "Harvest-only helper" grants exactly its entitlements', () => {
    const { roles, profiles } = seedDefaultRbac();
    const harvestRole: RoleRecord = {
      id: 'r-harvest',
      name: 'Harvest only',
      entitlements: [
        'round.record',
        'harvest.record',
        'media.upload',
        'farm.view',
      ],
      isSystem: false,
      status: 'ACTIVE',
    };
    const harvestProfile: ProfileRecord = {
      id: 'p-harvest',
      name: 'Harvest-only helper',
      roleIds: ['r-harvest'],
      isSystem: false,
      status: 'ACTIVE',
    };
    const rbac = buildTenantRbac(
      [...roles, harvestRole],
      [...profiles, harvestProfile]
    );
    const granted = resolveMemberEntitlements(
      rbac,
      member('helper', 'p-harvest')
    );
    expect([...granted].sort()).toEqual([
      'farm.view',
      'harvest.record',
      'media.upload',
      'round.record',
    ]);
    expect(codeOf(() => requireEntitlement(granted, 'sample.record'))).toBe(
      'FORBIDDEN'
    );
  });

  it('rejects unknown entitlements and roles', () => {
    expect(
      codeOf(() => assertKnownEntitlements(['harvest.record', 'tree.destroy']))
    ).toBe('UNKNOWN_ENTITLEMENT');
    expect(
      codeOf(() =>
        assertKnownRoles(defaults(), [SYSTEM_ROLE_IDS.reader, 'ghost'])
      )
    ).toBe('UNKNOWN_ROLE');
  });
});

describe('guardrails', () => {
  it('no escalation: cannot grant what you do not hold', () => {
    const rbac = defaults();
    const memberGrants = entitlementsForProfile(
      rbac,
      SYSTEM_PROFILE_IDS.member
    );
    expect(() =>
      assertNoEscalation(memberGrants, ['harvest.record', 'sale.record'])
    ).not.toThrow();
    expect(
      codeOf(() =>
        assertNoEscalation(memberGrants, ['harvest.record', 'member.manage'])
      )
    ).toBe('ESCALATION');
    // composing a profile from roles is checked on the roles' combined grants
    const ownerRoleGrants = grantedByRoles(rbac, [SYSTEM_ROLE_IDS.tenantAdmin]);
    expect(
      codeOf(() => assertNoEscalation(memberGrants, ownerRoleGrants))
    ).toBe('ESCALATION');
  });

  it('no lock-out: the last tenant admin cannot be demoted or removed', () => {
    const rbac = defaults();
    const ownerOnly = [
      member('owner', SYSTEM_PROFILE_IDS.owner),
      member('h', SYSTEM_PROFILE_IDS.farmHelper),
    ];
    expect(() => assertNoLockout(rbac, ownerOnly)).not.toThrow();

    const demoted = [
      member('owner', SYSTEM_PROFILE_IDS.member),
      member('h', SYSTEM_PROFILE_IDS.farmHelper),
    ];
    expect(codeOf(() => assertNoLockout(rbac, demoted))).toBe('LOCKOUT');

    const removed = [member('owner', SYSTEM_PROFILE_IDS.owner, 'REMOVED')];
    expect(codeOf(() => assertNoLockout(rbac, removed))).toBe('LOCKOUT');
  });

  it('no lock-out: editing roles that strip admin rights from every admin is rejected', () => {
    const { roles, profiles } = seedDefaultRbac();
    const stripped = roles.map(r =>
      r.id === SYSTEM_ROLE_IDS.tenantAdmin
        ? { ...r, entitlements: ['tenant.manage' as const] }
        : r
    );
    const members = [member('owner', SYSTEM_PROFILE_IDS.owner)];
    expect(
      codeOf(() =>
        assertNoLockout(buildTenantRbac(stripped, profiles), members)
      )
    ).toBe('LOCKOUT');
  });

  it('a second admin makes demoting the first one safe', () => {
    const rbac = defaults();
    const members = [
      member('a', SYSTEM_PROFILE_IDS.member),
      member('b', SYSTEM_PROFILE_IDS.owner),
    ];
    expect(() => assertNoLockout(rbac, members)).not.toThrow();
  });

  it('the built-in Owner profile cannot be deleted', () => {
    expect(codeOf(() => assertProfileDeletable(SYSTEM_PROFILE_IDS.owner))).toBe(
      'SYSTEM_PROFILE_PROTECTED'
    );
    expect(() =>
      assertProfileDeletable(SYSTEM_PROFILE_IDS.viewer)
    ).not.toThrow();
  });
});
