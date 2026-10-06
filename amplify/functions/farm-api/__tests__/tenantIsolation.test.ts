/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { loadTenantAccess } from '../lib/authorize';
import { OPERATIONS } from '../operations';
import { installFakeDdb } from './fakeDdb';

/**
 * Systematic tenant isolation (#107): every tenant-scoped operation in the
 * registry, called by someone who may not use it, is refused with the same
 * FORBIDDEN, before its input is validated, and writes nothing.
 */

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const T2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2D';
type Rec = Record<string, unknown>;
const EMAILS: Record<string, string> = {
  owner: 'owner@farm.lk',
  other: 'other@farm.lk',
  helper: 'helper@farm.lk',
};

const call = (fieldName: string, args: Rec, sub: string | null) =>
  handler({
    arguments: args,
    identity: sub ? { sub, claims: { email: EMAILS[sub] } } : null,
    info: { fieldName },
  } as unknown as AppSyncResolverEvent<Rec>) as Promise<Rec>;

const tenant = (sub: string, tenantId: string, farmId: string) =>
  call(
    'createTenant',
    {
      tenantId,
      name: `${sub} farm`,
      defaultTimezone: 'Asia/Colombo',
      defaultCurrency: 'LKR',
      defaultLocale: 'en',
      farmId,
      farmName: 'Home',
    },
    sub
  );

const tenantOps = Object.entries(OPERATIONS).filter(
  ([, op]) => op.kind === 'tenant'
);
const snapshot = () => JSON.stringify([...fake.store.entries()].sort());

beforeAll(async () => {
  fake.reset();
  await tenant('owner', T, '01J9ZQ3M5K8R2V7W4X6Y0A1B2E');
  await tenant('other', T2, '01J9ZQ3M5K8R2V7W4X6Y0A1B2F');
  await call(
    'inviteMember',
    {
      tenantId: T,
      email: EMAILS['helper'],
      profileId: SYSTEM_PROFILE_IDS.farmHelper,
    },
    'owner'
  );
  await call('acceptInvite', { tenantId: T }, 'helper');
});

it('covers the registry', () => {
  expect(tenantOps.length).toBeGreaterThan(40);
});

describe.each(tenantOps)('%s', name => {
  it('refuses a member of another tenant, before validating input, without writing', async () => {
    const before = snapshot();
    await expect(call(name, { tenantId: T }, 'other')).rejects.toThrow(
      /^FORBIDDEN/
    );
    // Even with plausible-looking input the answer is the same
    await expect(
      call(name, { tenantId: T, id: 'x', farmId: 'x', quantity: -1 }, 'other')
    ).rejects.toThrow(/^FORBIDDEN/);
    expect(snapshot()).toBe(before);
  });

  it('refuses an unknown tenant', async () => {
    await expect(
      call(name, { tenantId: '01J9ZQ3M5K8R2V7W4X6Y0A1B2Z' }, 'owner')
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('requires sign-in', async () => {
    await expect(call(name, { tenantId: T }, null)).rejects.toThrow(
      /^UNAUTHENTICATED/
    );
  });

  it('requires a tenant', async () => {
    await expect(call(name, {}, 'owner')).rejects.toThrow(
      /^VALIDATION: tenantId/
    );
  });
});

it('a helper is refused every operation outside their entitlements, without writing', async () => {
  const { entitlements } = await loadTenantAccess(T, 'helper');
  const denied = tenantOps.filter(
    ([, op]) => op.kind === 'tenant' && !entitlements.has(op.entitlement)
  );
  expect(denied.length).toBeGreaterThan(0);
  const before = snapshot();
  for (const [name] of denied)
    await expect(call(name, { tenantId: T }, 'helper')).rejects.toThrow(
      /^FORBIDDEN/
    );
  expect(snapshot()).toBe(before);
});

it('a permitted caller with bad input gets a validation error, not FORBIDDEN', async () => {
  await expect(
    call('createZone', { tenantId: T, farmId: 'nope' }, 'owner')
  ).rejects.toThrow(/^VALIDATION/);
});
