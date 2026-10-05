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
const F2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2F';
type Rec = Record<string, unknown>;
const call = (fieldName: string, args: Rec, sub = 'owner', tenantId = T) =>
  handler({
    arguments: { tenantId, ...args },
    identity: { sub, claims: { email: `${sub}@farm.lk` } },
    info: { fieldName },
  } as unknown as AppSyncResolverEvent<Rec>) as Promise<Rec>;

let roundId = '';
let harvest: Rec = {};

beforeEach(async () => {
  fake.reset();
  for (const [tenantId, farmId, sub] of [
    [T, F, 'owner'],
    [T2, F2, 'other'],
  ] as const) {
    await call(
      'createTenant',
      {
        name: 'Farm',
        defaultTimezone: 'Asia/Colombo',
        defaultCurrency: 'LKR',
        defaultLocale: 'en',
        farmId,
        farmName: 'Home Farm',
      },
      sub,
      tenantId
    );
  }
  const { created } = (await call('bulkCreateTrees', {
    farmId: F,
    start: 1,
    count: 2,
    status: 'PRODUCING',
  })) as unknown as {
    created: { id: string }[];
  };
  roundId = ulid();
  await call('createPluckingRound', {
    farmId: F,
    roundId,
    roundDate: '2026-05-10',
    plannedTreeIds: [created[0]!.id],
  });
  harvest = await call('recordTreeHarvest', {
    roundId,
    treeId: created[0]!.id,
    harvestId: ulid(),
    quantity: 20,
  });
  await call('completePluckingRound', { roundId, expectedVersion: 1 });
  await call('correctTreeHarvest', {
    harvestId: harvest['id'],
    expectedVersion: harvest['version'],
    quantity: 22,
    reason: 'Recount',
  });
  await call('backfillSale', {
    farmId: F,
    saleId: ulid(),
    saleDate: '2026-02-14',
    source: 'WHATSAPP_BACKFILL',
    buyerId: null,
    lines: [{ sizeClass: 'LARGE', quantity: 23, unitPrice: 140 }],
    notes: '=HYPERLINK("http://x")',
  });
});

describe('change history (#105, DQ-007)', () => {
  it('one record: who changed what, newest first, with before/after', async () => {
    const page = await call('listAudit', { entityId: harvest['id'] });
    const entries = page['entries'] as Rec[];
    expect(entries.map(e => e['action'])).toEqual([
      'harvest.correct',
      'harvest.record',
    ]);
    expect(entries[0]).toMatchObject({ actorEmail: 'owner@farm.lk' });
    expect(JSON.parse(String(entries[0]!['details']))).toMatchObject({
      before: { quantity: 20 },
      after: { quantity: 22 },
      reason: 'Recount',
    });
  });

  it('the tenant feed lists everything, paginated, never another tenant’s', async () => {
    const first = await call('listAudit', { limit: 3 });
    expect((first['entries'] as Rec[])[0]).toMatchObject({
      action: 'sale.backfill',
    });
    expect(first['nextToken']).toBeTruthy();
    const rest = await call('listAudit', {
      limit: 100,
      nextToken: first['nextToken'],
    });
    const actions = [
      ...(first['entries'] as Rec[]),
      ...(rest['entries'] as Rec[]),
    ].map(e => e['action']);
    expect(actions).toEqual(
      expect.arrayContaining([
        'round.complete',
        'harvest.correct',
        'tenant.create',
      ])
    );
    const theirs = await call('listAudit', {}, 'other', T2);
    expect(
      (theirs['entries'] as Rec[]).every(
        e => !['harvest.correct', 'sale.backfill'].includes(String(e['action']))
      )
    ).toBe(true);
    await expect(
      call('listAudit', { nextToken: first['nextToken'] }, 'other', T2)
    ).rejects.toThrow(/^VALIDATION: nextToken/);
  });

  it('needs audit.view: a farm helper cannot read it', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#helper',
      tenantId: T,
      userId: 'helper',
      profileId: SYSTEM_PROFILE_IDS.farmHelper,
      status: 'ACTIVE',
    });
    await expect(call('listAudit', {}, 'helper')).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('CSV export (#106)', () => {
  const csv = async (kind: string, sub = 'owner', tenantId = T, farmId = F) =>
    call('exportCsv', { farmId, kind }, sub, tenantId) as Promise<{
      filename: string;
      csv: string;
    }>;

  it('trees, harvests and sales with headers; formulas neutralised', async () => {
    const trees = await csv('trees');
    expect(trees.filename).toBe(
      `Home-Farm-trees-${  new Date().toISOString().slice(0, 10)  }.csv`
    );
    expect(trees.csv.split('\r\n')[0]).toBe(
      '﻿Tree code,Label,Status,Variety,Planted,Last plucked,Latest sample size,Notes'
    );
    expect(trees.csv).toContain('C-001,,PRODUCING');
    const harvests = await csv('harvests');
    expect(harvests.csv).toContain(
      '2026-05-10,C-001,22,CONFIRMED,LIVE_APP,yes'
    );
    const sales = await csv('sales');
    expect(sales.csv).toContain('LARGE,23,NUT,140,3220,3220');
    expect(sales.csv).toContain('WHATSAPP_BACKFILL');
    const stock = await csv('stock');
    expect(stock.csv).toContain('HARVEST_IN,20');
  });

  it('is tenant-scoped: another tenant cannot export this farm', async () => {
    await expect(csv('trees', 'other', T2, F)).rejects.toThrow(/^NOT_FOUND/);
    expect((await csv('trees', 'other', T2, F2)).csv).not.toContain('C-001');
  });
});
