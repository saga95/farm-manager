/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { z } from 'zod';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { tenantOperation } from '../lib/operation';
import { installFakeDdb } from './fakeDdb';

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const TENANT_A = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const TENANT_B = '01J9ZQ3M5K8R2V7W4X6Y0A1B2D';
const FARM_A = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';
const FARM_B = '01J9ZQ3M5K8R2V7W4X6Y0A1B2F';

const event = (
  fieldName: string,
  args: Record<string, unknown>,
  sub: string | null = 'user-a'
) =>
  ({
    arguments: args,
    identity: sub ? { sub, claims: { email: `${sub}@example.com` } } : null,
    info: { fieldName },
  }) as unknown as AppSyncResolverEvent<Record<string, unknown>>;

const tenantArgs = (
  tenantId: string,
  farmId: string,
  name = 'One-acre farm'
) => ({
  tenantId,
  name,
  defaultTimezone: 'Asia/Colombo',
  defaultCurrency: 'LKR',
  defaultLocale: 'en',
  farmId,
  farmName: 'Home farm',
  farmArea: 1,
  farmAreaUnit: 'ACRE',
});

beforeEach(() => fake.reset());

describe('createTenant', () => {
  it('creates tenant, default RBAC, owner membership, farm and audit atomically', async () => {
    const res = await handler(
      event('createTenant', tenantArgs(TENANT_A, FARM_A))
    );
    expect(res).toEqual({
      tenantId: TENANT_A,
      farmId: FARM_A,
      replayed: false,
    });

    const items = [...fake.store.values()];
    const byType = (t: string) => items.filter(i => i['entityType'] === t);
    expect(byType('Tenant')).toHaveLength(1);
    expect(byType('Role')).toHaveLength(8);
    expect(byType('Profile')).toHaveLength(4);
    expect(byType('Farm')).toHaveLength(1);
    expect(byType('AuditLog')).toHaveLength(1);

    const [member] = byType('TenantMember');
    expect(member).toMatchObject({
      PK: `T#${TENANT_A}`,
      SK: 'MEMBER#user-a',
      GSI1PK: 'U#user-a',
      profileId: SYSTEM_PROFILE_IDS.owner,
      status: 'ACTIVE',
    });
    // every item is tenant-scoped (ADR-0002)
    items.forEach(i => {
      expect(i['tenantId']).toBe(TENANT_A);
      expect(String(i['PK']).startsWith(`T#${TENANT_A}`)).toBe(true);
    });
  });

  it('is idempotent for the same caller and rejects reuse by another user', async () => {
    await handler(event('createTenant', tenantArgs(TENANT_A, FARM_A)));
    await expect(
      handler(event('createTenant', tenantArgs(TENANT_A, FARM_A)))
    ).resolves.toEqual({
      tenantId: TENANT_A,
      farmId: FARM_A,
      replayed: true,
    });
    await expect(
      handler(event('createTenant', tenantArgs(TENANT_A, FARM_A), 'user-b'))
    ).rejects.toThrow(/^CONFLICT/);
  });

  it('validates input', async () => {
    await expect(
      handler(
        event('createTenant', {
          ...tenantArgs(TENANT_A, FARM_A),
          defaultTimezone: 'Mars/Base',
        })
      )
    ).rejects.toThrow(/^VALIDATION: defaultTimezone/);
    await expect(
      handler(event('createTenant', { ...tenantArgs('not-a-ulid', FARM_A) }))
    ).rejects.toThrow(/^VALIDATION: tenantId/);
  });

  it('requires a signed-in user', async () => {
    await expect(
      handler(event('createTenant', tenantArgs(TENANT_A, FARM_A), null))
    ).rejects.toThrow(/^UNAUTHENTICATED/);
  });
});

describe('me', () => {
  it('lists only the caller’s memberships with resolved entitlements', async () => {
    await handler(
      event('createTenant', tenantArgs(TENANT_A, FARM_A, 'Farm A'), 'user-a')
    );
    await handler(
      event('createTenant', tenantArgs(TENANT_B, FARM_B, 'Farm B'), 'user-b')
    );

    const res = (await handler(event('me', {}, 'user-a'))) as {
      memberships: {
        tenantId: string;
        tenantName: string;
        profileName: string;
        entitlements: string[];
      }[];
    };
    expect(res.memberships).toHaveLength(1);
    expect(res.memberships[0]).toMatchObject({
      tenantId: TENANT_A,
      tenantName: 'Farm A',
      profileName: 'Owner',
    });
    expect(res.memberships[0]!.entitlements).toContain('member.manage');
  });
});

describe('tenant operations (AC-TN-001/003)', () => {
  const probe = tenantOperation({
    name: 'probe',
    entitlement: 'sale.record',
    input: z.object({ tenantId: z.string() }),
    handler: async (_i, ctx) => ({ ok: true, tenant: ctx.access.tenantId }),
  });

  beforeEach(async () => {
    await handler(
      event('createTenant', tenantArgs(TENANT_A, FARM_A), 'owner-a')
    );
    await handler(
      event('createTenant', tenantArgs(TENANT_B, FARM_B), 'owner-b')
    );
  });

  it('allows a member holding the entitlement', async () => {
    await expect(
      probe.run(event('probe', { tenantId: TENANT_A }, 'owner-a'), 'now')
    ).resolves.toEqual({
      ok: true,
      tenant: TENANT_A,
    });
  });

  it('rejects a user from another tenant even with a known tenant id', async () => {
    await expect(
      probe.run(event('probe', { tenantId: TENANT_B }, 'owner-a'), 'now')
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('rejects a member whose profile lacks the entitlement (Farm helper cannot record sales)', async () => {
    fake.put({
      PK: `T#${TENANT_A}`,
      SK: 'MEMBER#helper-a',
      tenantId: TENANT_A,
      userId: 'helper-a',
      profileId: SYSTEM_PROFILE_IDS.farmHelper,
      status: 'ACTIVE',
    });
    await expect(
      probe.run(event('probe', { tenantId: TENANT_A }, 'helper-a'), 'now')
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('rejects suspended members', async () => {
    fake.put({
      PK: `T#${TENANT_A}`,
      SK: 'MEMBER#gone',
      tenantId: TENANT_A,
      userId: 'gone',
      profileId: SYSTEM_PROFILE_IDS.owner,
      status: 'SUSPENDED',
    });
    await expect(
      probe.run(event('probe', { tenantId: TENANT_A }, 'gone'), 'now')
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('router', () => {
  it('fails closed on unknown fields', async () => {
    await expect(handler(event('dropTables', {}))).rejects.toThrow(
      /^NOT_FOUND/
    );
  });

  it('hides unexpected errors as INTERNAL', async () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    delete process.env['FARM_TABLE_NAME'];
    await expect(handler(event('me', {}))).rejects.toThrow(
      /^INTERNAL: Unexpected error$/
    );
    process.env['FARM_TABLE_NAME'] = 'FarmData-test';
    spy.mockRestore();
  });
});
