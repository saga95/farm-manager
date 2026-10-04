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
const F = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';
type Rec = Record<string, unknown>;
const call = (fieldName: string, args: Rec, sub = 'owner') =>
  handler({
    arguments: { tenantId: T, ...args },
    identity: { sub, claims: {} },
    info: { fieldName },
  } as unknown as AppSyncResolverEvent<Rec>) as Promise<Rec>;

let zoneId = '';
let otherZone = '';
let bedId = '';
const byId = (id: string) =>
  [...fake.store.values()].find(i => i['id'] === id)!;

const ginger = (extra: Rec = {}) =>
  call('createCycle', {
    farmId: F,
    cycleId: ulid(),
    name: 'Ginger 2026-01',
    cropName: 'Ginger',
    zoneId,
    growingSpaceId: bedId,
    plantedAt: '2026-01-15',
    estimatedPlantCount: 180,
    ...extra,
  });

beforeEach(async () => {
  fake.reset();
  await call('createTenant', {
    name: 'X',
    defaultTimezone: 'Asia/Colombo',
    defaultCurrency: 'LKR',
    defaultLocale: 'en',
    farmId: F,
    farmName: 'F',
  });
  zoneId = ulid();
  otherZone = ulid();
  bedId = ulid();
  await call('createZone', {
    farmId: F,
    zoneId,
    name: 'Polytunnel',
    zoneType: 'POLYTUNNEL',
  });
  await call('createZone', {
    farmId: F,
    zoneId: otherZone,
    name: 'Backyard',
    zoneType: 'BACKYARD',
  });
  await call('createSpace', {
    farmId: F,
    spaceId: bedId,
    name: 'Bed 1',
    spaceType: 'BED',
    parentZoneId: zoneId,
  });
});

describe('production cycles (#91, #92)', () => {
  it('AC-PC-001 / AC-PT-002: a 180-plant ginger cycle without plant records', async () => {
    const c = await ginger();
    expect(c).toMatchObject({
      status: 'ACTIVE',
      cropCode: 'GINGER',
      estimatedPlantCount: 180,
      zoneName: 'Polytunnel',
      growingSpaceId: bedId,
    });
    expect(
      [...fake.store.values()].filter(
        i => i['entityType'] === 'ProductionCycle'
      )
    ).toHaveLength(1);
    expect([...fake.store.values()].some(i => i['entityType'] === 'Tree')).toBe(
      false
    );
  });

  it('a bed must belong to the chosen zone', async () => {
    await expect(ginger({ zoneId: otherZone })).rejects.toThrow(
      /^VALIDATION: growingSpaceId/
    );
  });

  it('moves through its lifecycle; AC-PC-004: completing keeps history', async () => {
    const c = await ginger();
    await call('recordActivity', {
      activityId: ulid(),
      targetId: c['id'],
      activityType: 'WATERING',
      activityDate: '2026-02-01',
    });
    const h = await call('updateCycle', {
      cycleId: c['id'],
      expectedVersion: 2,
      status: 'HARVESTING',
    });
    const done = await call('updateCycle', {
      cycleId: c['id'],
      expectedVersion: h['version'],
      status: 'COMPLETED',
      statusDate: '2026-09-30',
    });
    expect(done).toMatchObject({ status: 'COMPLETED', endedAt: '2026-09-30' });
    const detail = await call('getCycle', { cycleId: c['id'] });
    expect(detail['activities']).toHaveLength(1);
    await expect(
      call('updateCycle', {
        cycleId: c['id'],
        expectedVersion: done['version'],
        status: 'ACTIVE',
      })
    ).rejects.toThrow(/^VALIDATION: status/);
    expect(await call('listCycles', { farmId: F })).toEqual([]);
    expect(
      await call('listCycles', { farmId: F, includeClosed: true })
    ).toHaveLength(1);
  });

  it('edits clear optional fields with null and keep required ones', async () => {
    const c = await ginger({ variety: 'Local' });
    const u = await call('updateCycle', {
      cycleId: c['id'],
      expectedVersion: 1,
      variety: null,
      cropName: 'Turmeric',
    });
    expect(u).toMatchObject({
      variety: null,
      cropName: 'Turmeric',
      cropCode: 'TURMERIC',
      name: 'Ginger 2026-01',
    });
  });
});

describe('activities (#94, AC-MA-001/002, AC-PC-002)', () => {
  it('records maintenance against the whole cycle, newest first', async () => {
    const c = await ginger();
    for (const [type, date] of [
      ['WATERING', '2026-02-01'],
      ['WEEDING', '2026-02-10'],
      ['GENERAL_NOTE', '2026-02-05'],
    ] as const) {
      await call('recordActivity', {
        activityId: ulid(),
        targetId: c['id'],
        activityType: type,
        activityDate: date,
        notes: 'ok',
      });
    }
    const detail = await call('getCycle', { cycleId: c['id'] });
    expect((detail['activities'] as Rec[]).map(a => a['activityType'])).toEqual(
      ['WEEDING', 'GENERAL_NOTE', 'WATERING']
    );
    expect(detail['cycle']).toMatchObject({
      activityCount: 3,
      lastActivityAt: '2026-02-10',
    });
  });

  it('activities on a zone or bed too; a retry saves once', async () => {
    const activityId = ulid();
    const args = {
      activityId,
      targetId: zoneId,
      activityType: 'MULCHING',
      activityDate: '2026-03-01',
    };
    await call('recordActivity', args);
    await call('recordActivity', args);
    expect(await call('listActivities', { targetId: zoneId })).toHaveLength(1);
    await call('recordActivity', {
      activityId: ulid(),
      targetId: bedId,
      activityType: 'WEEDING',
      activityDate: '2026-03-02',
    });
    expect(await call('listActivities', { targetId: bedId })).toHaveLength(1);
  });

  it('fertiliser from farm inputs: the input stock goes down once', async () => {
    const c = await ginger();
    const itemId = ulid();
    await call('createInputItem', {
      farmId: F,
      itemId,
      name: 'Compost',
      category: 'FERTILIZER',
      unit: 'KG',
      openingQuantity: 50,
    });
    const activityId = ulid();
    const args = {
      activityId,
      targetId: c['id'],
      activityType: 'FERTILIZER',
      activityDate: '2026-02-03',
      quantity: 12.5,
      inputItemId: itemId,
    };
    const a = await call('recordActivity', args);
    await call('recordActivity', args);
    expect(a).toMatchObject({
      materialName: 'Compost',
      unit: 'KG',
      quantity: 12.5,
    });
    expect(byId(itemId)['quantity']).toBe(37.5);
    await expect(
      call('recordActivity', { ...args, activityId: ulid(), quantity: 40 })
    ).rejects.toThrow(/^VALIDATION: quantity: only 37.5 kg of Compost/);
    expect(byId(c['id'] as string)['activityCount']).toBe(1);
  });

  it('a removed activity leaves the timeline; viewers cannot record', async () => {
    const c = await ginger();
    const a = await call('recordActivity', {
      activityId: ulid(),
      targetId: c['id'],
      activityType: 'PRUNING',
      activityDate: '2026-02-01',
    });
    await call('archiveActivity', { activityId: a['id'], expectedVersion: 1 });
    expect(
      (await call('getCycle', { cycleId: c['id'] }))['activities']
    ).toEqual([]);
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#viewer',
      tenantId: T,
      userId: 'viewer',
      profileId: SYSTEM_PROFILE_IDS.viewer,
      status: 'ACTIVE',
    });
    await expect(
      call(
        'recordActivity',
        {
          activityId: ulid(),
          targetId: c['id'],
          activityType: 'WATERING',
          activityDate: '2026-02-02',
        },
        'viewer'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});
