/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const T2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2D';
const F = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';
const F2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2F';
const Z1 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2G';
const S1 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2H';

const call = (
  fieldName: string,
  args: Record<string, unknown>,
  sub = 'owner'
) =>
  handler({
    arguments: args,
    identity: { sub, claims: {} },
    info: { fieldName },
  } as unknown as AppSyncResolverEvent<Record<string, unknown>>);

beforeEach(async () => {
  fake.reset();
  const tenant = (tenantId: string, farmId: string, sub: string) =>
    call(
      'createTenant',
      {
        tenantId,
        name: 'Farm co',
        defaultTimezone: 'Asia/Colombo',
        defaultCurrency: 'LKR',
        defaultLocale: 'en',
        farmId,
        farmName: 'Home farm',
      },
      sub
    );
  await tenant(T, F, 'owner');
  await tenant(T2, F2, 'other');
});

describe('farms', () => {
  it('lists the tenant’s farms and updates with optimistic locking', async () => {
    const farms = (await call('listFarms', { tenantId: T })) as {
      id: string;
      version: number;
    }[];
    expect(farms.map(f => f.id)).toEqual([F]);

    const updated = (await call('updateFarm', {
      tenantId: T,
      farmId: F,
      expectedVersion: 1,
      area: 1,
      areaUnit: 'ACRE',
    })) as {
      version: number;
      area: number;
    };
    expect(updated).toMatchObject({ version: 2, area: 1 });
    await expect(
      call('updateFarm', {
        tenantId: T,
        farmId: F,
        expectedVersion: 1,
        name: 'x',
      })
    ).rejects.toThrow(/^CONFLICT/);
  });

  it('never returns internal key attributes', async () => {
    const [farm] = (await call('listFarms', { tenantId: T })) as Record<
      string,
      unknown
    >[];
    expect(Object.keys(farm!)).not.toEqual(expect.arrayContaining(['PK']));
    expect(farm).not.toHaveProperty('GSI2PK');
  });
});

describe('zones', () => {
  it('creates, lists, archives a polytunnel zone (AC-PT-001) and writes audit entries', async () => {
    const z = await call('createZone', {
      tenantId: T,
      farmId: F,
      zoneId: Z1,
      name: 'Polytunnel',
      zoneType: 'POLYTUNNEL',
    });
    expect(z).toMatchObject({
      id: Z1,
      status: 'ACTIVE',
      version: 1,
      farmId: F,
    });
    // idempotent replay
    await expect(
      call('createZone', {
        tenantId: T,
        farmId: F,
        zoneId: Z1,
        name: 'Polytunnel',
        zoneType: 'POLYTUNNEL',
      })
    ).resolves.toMatchObject({ id: Z1, version: 1 });

    await call('updateZone', {
      tenantId: T,
      farmId: F,
      zoneId: Z1,
      expectedVersion: 1,
      status: 'ARCHIVED',
    });
    expect(await call('listZones', { tenantId: T, farmId: F })).toEqual([]);
    expect(
      await call('listZones', { tenantId: T, farmId: F, includeArchived: true })
    ).toHaveLength(1);

    const audits = [...fake.store.values()].filter(
      i => i['entityType'] === 'AuditLog' && i['entityId'] === Z1
    );
    expect(audits.map(a => a['action']).sort()).toEqual([
      'zone.create',
      'zone.update',
    ]);
  });

  it('cannot create a zone on another tenant’s farm, even with its id', async () => {
    await expect(
      call('createZone', {
        tenantId: T,
        farmId: F2,
        zoneId: Z1,
        name: 'Sneaky',
        zoneType: 'OTHER',
      })
    ).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      call('createZone', {
        tenantId: T2,
        farmId: F2,
        zoneId: Z1,
        name: 'Sneaky',
        zoneType: 'OTHER',
      })
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('requires zone.manage (a viewer cannot create zones)', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#viewer',
      tenantId: T,
      userId: 'viewer',
      profileId: SYSTEM_PROFILE_IDS.viewer,
      status: 'ACTIVE',
    });
    await expect(
      call('listZones', { tenantId: T, farmId: F }, 'viewer')
    ).resolves.toEqual([]);
    await expect(
      call(
        'createZone',
        { tenantId: T, farmId: F, zoneId: Z1, name: 'X', zoneType: 'OTHER' },
        'viewer'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('validates the zone type', async () => {
    await expect(
      call('createZone', {
        tenantId: T,
        farmId: F,
        zoneId: Z1,
        name: 'X',
        zoneType: 'MOON',
      })
    ).rejects.toThrow(/^VALIDATION: zoneType/);
  });
});

describe('growing spaces (§41.2)', () => {
  it('creates a space with dimensions and computed area (AC-SP-001)', async () => {
    await call('createZone', {
      tenantId: T,
      farmId: F,
      zoneId: Z1,
      name: 'Backyard',
      zoneType: 'BACKYARD',
    });
    const s = await call('createSpace', {
      tenantId: T,
      farmId: F,
      spaceId: S1,
      parentZoneId: Z1,
      name: 'Back strip',
      spaceType: 'NARROW_STRIP',
      width: 1.2,
      length: 8,
      shadeLevel: 'MEDIUM',
      waterAccess: 'TAP_NEARBY',
    });
    expect(s).toMatchObject({
      calculatedAreaSqM: 9.6,
      status: 'ACTIVE',
      parentZoneId: Z1,
    });
  });

  it('marks a space unused and filters by status (AC-SP-002)', async () => {
    await call('createSpace', {
      tenantId: T,
      farmId: F,
      spaceId: S1,
      name: 'Corner',
      spaceType: 'OPEN_GROUND',
    });
    await call('updateSpace', {
      tenantId: T,
      farmId: F,
      spaceId: S1,
      expectedVersion: 1,
      status: 'UNUSED',
      length: 3,
    });
    expect(
      await call('listSpaces', { tenantId: T, farmId: F, status: 'UNUSED' })
    ).toHaveLength(1);
    expect(
      await call('listSpaces', { tenantId: T, farmId: F, status: 'ACTIVE' })
    ).toHaveLength(0);
  });

  it('recomputes area on update and rejects archived parent zones', async () => {
    await call('createZone', {
      tenantId: T,
      farmId: F,
      zoneId: Z1,
      name: 'Old',
      zoneType: 'OTHER',
    });
    await call('createSpace', {
      tenantId: T,
      farmId: F,
      spaceId: S1,
      name: 'Bed',
      spaceType: 'BED',
      width: 1,
      length: 2,
    });
    const s = (await call('updateSpace', {
      tenantId: T,
      farmId: F,
      spaceId: S1,
      expectedVersion: 1,
      length: 5,
    })) as {
      calculatedAreaSqM: number;
    };
    expect(s.calculatedAreaSqM).toBe(5);
    await call('updateZone', {
      tenantId: T,
      farmId: F,
      zoneId: Z1,
      expectedVersion: 1,
      status: 'ARCHIVED',
    });
    await expect(
      call('updateSpace', {
        tenantId: T,
        farmId: F,
        spaceId: S1,
        expectedVersion: 2,
        parentZoneId: Z1,
      })
    ).rejects.toThrow(/^VALIDATION: parentZoneId/);
  });
});
