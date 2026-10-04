/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const T2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2D';
const F = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';
type Rec = Record<string, unknown>;
const EMAILS: Record<string, string> = {
  owner: 'owner@farm.lk',
  helper: 'helper@farm.lk',
  mgr: 'mgr@farm.lk',
  stranger: 'someone@else.lk',
};
const call = (
  fieldName: string,
  args: Rec,
  sub = 'owner',
  tenantId: string | null = T
) =>
  handler({
    arguments: tenantId ? { tenantId, ...args } : args,
    identity: { sub, claims: { email: EMAILS[sub] } },
    info: { fieldName },
  } as unknown as AppSyncResolverEvent<Rec>) as Promise<Rec>;

const team = () => call('getTeam', {});
const member = async (userId: string) =>
  ((await team())['members'] as Rec[]).find(m => m['userId'] === userId)!;

async function join(sub: string, profileId: string, tenantId = T) {
  await call(
    'inviteMember',
    { email: EMAILS[sub], profileId },
    'owner',
    tenantId
  );
  await call('acceptInvite', { tenantId }, sub, null);
}

beforeEach(async () => {
  fake.reset();
  await call('createTenant', {
    name: 'Sagara Farm',
    defaultTimezone: 'Asia/Colombo',
    defaultCurrency: 'LKR',
    defaultLocale: 'en',
    farmId: F,
    farmName: 'Home',
  });
});

describe('invites (#37)', () => {
  it('the invitee sees the invite under their verified email and joins with that profile', async () => {
    await call('inviteMember', {
      email: ' Helper@Farm.LK ',
      profileId: SYSTEM_PROFILE_IDS.farmHelper,
    });
    expect(await call('myInvites', {}, 'helper', null)).toEqual([
      expect.objectContaining({
        tenantId: T,
        tenantName: 'Sagara Farm',
        invitedBy: 'owner@farm.lk',
      }),
    ]);
    expect(await call('myInvites', {}, 'stranger', null)).toEqual([]);
    await expect(
      call('acceptInvite', { tenantId: T }, 'stranger', null)
    ).rejects.toThrow(/^NOT_FOUND/);
    await call('acceptInvite', { tenantId: T }, 'helper', null);
    expect(await member('helper')).toMatchObject({
      email: 'helper@farm.lk',
      profileName: 'Farm helper',
      status: 'ACTIVE',
    });
    expect(await call('myInvites', {}, 'helper', null)).toEqual([]);
    const me = (await call('me', {}, 'helper', null)) as { memberships: Rec[] };
    expect(me.memberships).toEqual([
      expect.objectContaining({ tenantId: T, profileName: 'Farm helper' }),
    ]);
  });

  it('revoked invites cannot be accepted; accepting never overwrites an active member', async () => {
    await call('inviteMember', {
      email: 'helper@farm.lk',
      profileId: SYSTEM_PROFILE_IDS.viewer,
    });
    await call('revokeInvite', { email: 'helper@farm.lk' });
    await expect(
      call('acceptInvite', { tenantId: T }, 'helper', null)
    ).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      call('inviteMember', {
        email: 'owner@farm.lk',
        profileId: SYSTEM_PROFILE_IDS.viewer,
      })
    ).rejects.toThrow(/^CONFLICT: email: already a member/);
  });
});

describe('helper access (#121 acceptance)', () => {
  it('a helper records field work but cannot manage members, archive, or change settings', async () => {
    await join('helper', SYSTEM_PROFILE_IDS.farmHelper);
    const roundId = ulid();
    const { created } = (await call('bulkCreateTrees', {
      farmId: F,
      start: 1,
      count: 1,
      status: 'PRODUCING',
    })) as {
      created: { id: string }[];
    };
    await expect(
      call(
        'createPluckingRound',
        {
          farmId: F,
          roundId,
          roundDate: '2026-10-05',
          plannedTreeIds: [created[0]!.id],
        },
        'helper'
      )
    ).resolves.toMatchObject({ id: roundId });
    await expect(call('getTeam', {}, 'helper')).rejects.toThrow(/^FORBIDDEN/);
    await expect(
      call(
        'inviteMember',
        { email: 'x@y.lk', profileId: SYSTEM_PROFILE_IDS.viewer },
        'helper'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
    await expect(
      call('archivePluckingRound', { roundId, expectedVersion: 1 }, 'helper')
    ).rejects.toThrow(/^FORBIDDEN/);
    await expect(
      call('updateFarm', { farmId: F, expectedVersion: 1, name: 'X' }, 'helper')
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('one user, different profiles in two tenants', async () => {
    await call(
      'createTenant',
      {
        name: 'Helper Own Farm',
        defaultTimezone: 'Asia/Colombo',
        defaultCurrency: 'LKR',
        defaultLocale: 'en',
        farmId: ulid(),
        farmName: 'Own',
      },
      'helper',
      T2
    );
    await join('helper', SYSTEM_PROFILE_IDS.viewer);
    const me = (await call('me', {}, 'helper', null)) as { memberships: Rec[] };
    expect(
      me.memberships.map(m => [m['tenantId'], m['profileName']]).sort()
    ).toEqual(
      [
        [T, 'Viewer'],
        [T2, 'Owner'],
      ].sort()
    );
  });

  it('a viewer gets an error on any write', async () => {
    await join('helper', SYSTEM_PROFILE_IDS.viewer);
    await expect(
      call(
        'bulkCreateTrees',
        { farmId: F, start: 1, count: 1, status: 'PRODUCING' },
        'helper'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('tenant-defined roles and profiles (#121)', () => {
  it('a custom "Harvest-only helper" gets exactly its entitlements; role edits apply on the next request', async () => {
    await call('saveRole', {
      roleId: 'harvest-only',
      expectedVersion: 0,
      name: 'Harvest only',
      entitlements: [
        'round.record',
        'harvest.record',
        'media.upload',
        'farm.view',
      ],
    });
    await call('saveProfile', {
      profileId: 'harvest-helper',
      expectedVersion: 0,
      name: 'Harvest-only helper',
      roleIds: ['harvest-only'],
    });
    await join('helper', 'harvest-helper');
    const { created } = (await call('bulkCreateTrees', {
      farmId: F,
      start: 1,
      count: 1,
      status: 'PRODUCING',
    })) as {
      created: { id: string }[];
    };
    const roundId = ulid();
    await call(
      'createPluckingRound',
      {
        farmId: F,
        roundId,
        roundDate: '2026-10-05',
        plannedTreeIds: [created[0]!.id],
      },
      'helper'
    );
    await expect(
      call(
        'bulkCreateTrees',
        { farmId: F, start: 5, count: 1, status: 'PRODUCING' },
        'helper'
      )
    ).rejects.toThrow(/^FORBIDDEN/);

    // Take harvest.record away: the very next request is refused
    await call('saveRole', {
      roleId: 'harvest-only',
      expectedVersion: 1,
      name: 'Harvest only',
      entitlements: ['round.record', 'media.upload', 'farm.view'],
    });
    await expect(
      call(
        'recordTreeHarvest',
        { roundId, treeId: created[0]!.id, harvestId: ulid(), quantity: 10 },
        'helper'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('rejects unknown entitlements and stale versions', async () => {
    await expect(
      call('saveRole', {
        roleId: 'r',
        expectedVersion: 0,
        name: 'R',
        entitlements: ['farm.view', 'make.coffee'],
      })
    ).rejects.toThrow(/^VALIDATION: unknown_entitlement/);
    await call('saveRole', {
      roleId: 'r',
      expectedVersion: 0,
      name: 'R',
      entitlements: ['farm.view'],
    });
    await expect(
      call('saveRole', {
        roleId: 'r',
        expectedVersion: 0,
        name: 'R2',
        entitlements: ['farm.view'],
      })
    ).rejects.toThrow(/^CONFLICT/);
  });
});

describe('guardrails (#121)', () => {
  it('lock-out: the last tenant admin cannot be demoted, suspended, or lose admin rights', async () => {
    const owner = await member('owner');
    await expect(
      call('updateMember', {
        userId: 'owner',
        expectedVersion: owner['version'],
        profileId: SYSTEM_PROFILE_IDS.viewer,
      })
    ).rejects.toThrow(/^VALIDATION: lockout/);
    await expect(
      call('updateMember', {
        userId: 'owner',
        expectedVersion: owner['version'],
        status: 'SUSPENDED',
      })
    ).rejects.toThrow(/^VALIDATION: lockout/);
    const team0 = await team();
    const adminRole = (team0['roles'] as Rec[]).find(r =>
      (r['entitlements'] as string[]).includes('member.manage')
    )!;
    await expect(
      call('saveRole', {
        roleId: adminRole['id'],
        expectedVersion: adminRole['version'],
        name: adminRole['name'],
        entitlements: (adminRole['entitlements'] as string[]).filter(
          e => e !== 'member.manage'
        ),
      })
    ).rejects.toThrow(/^VALIDATION: lockout/);
    await expect(
      call('saveProfile', {
        profileId: SYSTEM_PROFILE_IDS.owner,
        expectedVersion: 0,
        name: 'Owner',
        roleIds: [],
        status: 'ARCHIVED',
      })
    ).rejects.toThrow(/^VALIDATION: system_profile_protected/);
  });

  it('with a second admin, the first can step down', async () => {
    await join('mgr', SYSTEM_PROFILE_IDS.owner);
    const owner = await member('owner');
    await expect(
      call('updateMember', {
        userId: 'owner',
        expectedVersion: owner['version'],
        profileId: SYSTEM_PROFILE_IDS.viewer,
      })
    ).resolves.toMatchObject({ profileId: SYSTEM_PROFILE_IDS.viewer });
  });

  it('no escalation: a member manager cannot hand out rights they lack', async () => {
    await call('saveRole', {
      roleId: 'people',
      expectedVersion: 0,
      name: 'People',
      entitlements: ['member.manage', 'farm.view'],
    });
    await call('saveProfile', {
      profileId: 'people',
      expectedVersion: 0,
      name: 'People manager',
      roleIds: ['people'],
    });
    await join('mgr', 'people');
    await expect(
      call(
        'inviteMember',
        { email: 'x@y.lk', profileId: SYSTEM_PROFILE_IDS.owner },
        'mgr'
      )
    ).rejects.toThrow(/^FORBIDDEN: Cannot grant/);
    await expect(
      call(
        'inviteMember',
        { email: 'x@y.lk', profileId: SYSTEM_PROFILE_IDS.viewer },
        'mgr'
      )
    ).rejects.toThrow(/^FORBIDDEN: Cannot grant/);
  });

  it('role, profile and membership changes are audited', async () => {
    await call('saveRole', {
      roleId: 'r',
      expectedVersion: 0,
      name: 'R',
      entitlements: ['farm.view'],
    });
    await call('saveProfile', {
      profileId: 'p',
      expectedVersion: 0,
      name: 'P',
      roleIds: ['r'],
    });
    await join('helper', 'p');
    const actions = [...fake.store.values()]
      .filter(i => i['entityType'] === 'AuditLog')
      .map(i => i['action']);
    expect(actions).toEqual(
      expect.arrayContaining([
        'role.create',
        'profile.create',
        'member.invite',
        'member.join',
      ])
    );
  });
});
