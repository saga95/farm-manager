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
type Rec = Record<string, unknown>;
const call = (fieldName: string, args: Rec, sub = 'owner', tenantId = T) =>
  handler({
    arguments: { tenantId, ...args },
    identity: { sub, claims: {} },
    info: { fieldName },
  } as unknown as AppSyncResolverEvent<Rec>) as Promise<Rec>;

beforeEach(async () => {
  fake.reset();
  for (const [tenantId, sub] of [
    [T, 'owner'],
    [T2, 'other'],
  ] as const) {
    await handler({
      arguments: {
        tenantId,
        name: 'X',
        defaultTimezone: 'Asia/Colombo',
        defaultCurrency: 'LKR',
        defaultLocale: 'en',
        farmId: ulid(),
        farmName: 'F',
      },
      identity: { sub, claims: {} },
      info: { fieldName: 'createTenant' },
    } as unknown as AppSyncResolverEvent<Rec>);
  }
});

describe('buyers (#83, AC-SL-001)', () => {
  it('stores preferred Medium and acceptable Large; preferences are editable', async () => {
    const buyerId = ulid();
    const b = await call('createBuyer', {
      buyerId,
      name: 'Lake View Restaurant',
      preferredSizes: ['MEDIUM'],
      acceptableSizes: ['LARGE', 'MEDIUM'],
      requirementNote: 'Needs 40 every Friday',
    });
    expect(b).toMatchObject({
      preferredSizes: ['MEDIUM'],
      acceptableSizes: ['LARGE'],
      status: 'ACTIVE',
    });
    const u = await call('updateBuyer', {
      buyerId,
      expectedVersion: 1,
      preferredSizes: ['SMALL'],
      phone: '',
    });
    expect(u).toMatchObject({
      preferredSizes: ['SMALL'],
      acceptableSizes: ['LARGE'],
      phone: null,
    });
  });

  it('lists by name; archived buyers hidden unless asked', async () => {
    const a = ulid();
    await call('createBuyer', { buyerId: a, name: 'Zeta store' });
    await call('createBuyer', { buyerId: ulid(), name: 'Alpha kade' });
    expect((await call('listBuyers', {})) as unknown as Rec[]).toEqual([
      expect.objectContaining({ name: 'Alpha kade' }),
      expect.objectContaining({ name: 'Zeta store' }),
    ]);
    await call('updateBuyer', {
      buyerId: a,
      expectedVersion: 1,
      status: 'ARCHIVED',
    });
    expect(await call('listBuyers', {})).toHaveLength(1);
    expect(await call('listBuyers', { includeArchived: true })).toHaveLength(2);
  });

  it('tenant-isolated; viewers can read but not manage', async () => {
    const buyerId = ulid();
    await call('createBuyer', { buyerId, name: 'Mine' });
    await expect(call('getBuyer', { buyerId }, 'other', T2)).rejects.toThrow(
      /^NOT_FOUND/
    );
    expect(await call('listBuyers', {}, 'other', T2)).toEqual([]);
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#viewer',
      tenantId: T,
      userId: 'viewer',
      profileId: SYSTEM_PROFILE_IDS.viewer,
      status: 'ACTIVE',
    });
    await expect(
      call('getBuyer', { buyerId }, 'viewer')
    ).resolves.toMatchObject({ name: 'Mine' });
    await expect(
      call('createBuyer', { buyerId: ulid(), name: 'X' }, 'viewer')
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});
