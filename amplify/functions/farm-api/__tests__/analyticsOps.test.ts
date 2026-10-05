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
  } as unknown as AppSyncResolverEvent<Rec>) as Promise<unknown>;

const report = async (args: Rec = {}) =>
  JSON.parse(
    (await call('getAnalytics', {
      farmId: F,
      from: '2026-01-01',
      to: '2026-12-31',
      ...args,
    })) as string
  ) as Rec & {
    coconut: Rec & {
      totals: Rec;
      byMonth: Rec[];
      trees: Rec[];
      rounds: Rec;
      samples: Rec;
      insights: Rec[];
    };
    sales: Rec;
    stock: Rec & { current: Rec[]; adjustments: Rec[]; lowStock: Rec[] };
    crops: Rec[];
  };

let trees: { id: string; code: string }[] = [];
const tree = (code: string) => trees.find(t => t.code === code)!.id;

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
  trees = (
    (await call('bulkCreateTrees', {
      farmId: F,
      start: 1,
      count: 3,
      status: 'PRODUCING',
    })) as {
      created: { id: string; code: string }[];
    }
  ).created;
  await call('updateTree', {
    farmId: F,
    treeId: tree('C-003'),
    expectedVersion: 1,
    status: 'YOUNG',
  }).catch(() => undefined);
  // Live round in May with sample + stock
  const roundId = ulid();
  await call('createPluckingRound', {
    farmId: F,
    roundId,
    roundDate: '2026-05-10',
    plannedTreeIds: [tree('C-001'), tree('C-002')],
  });
  const h1 = (await call('recordTreeHarvest', {
    roundId,
    treeId: tree('C-001'),
    harvestId: ulid(),
    quantity: 20,
  })) as Rec;
  await call('recordTreeHarvest', {
    roundId,
    treeId: tree('C-002'),
    harvestId: ulid(),
    quantity: 15,
  });
  const done = (await call('completePluckingRound', {
    roundId,
    expectedVersion: 1,
  })) as Rec;
  await call('recordCoconutSample', {
    harvestId: h1['id'],
    sampleId: ulid(),
    sizeClass: 'LARGE',
  });
  // Backfilled March round with an unknown-tree count
  await call('backfillRound', {
    farmId: F,
    roundId: ulid(),
    roundDate: '2026-03-08',
    source: 'WHATSAPP_BACKFILL',
    entries: [{ treeId: tree('C-001'), harvestId: ulid(), quantity: 18 }],
    unattributedQuantity: 30,
  });
  // A sale, household use, a low farm input, a cucumber harvest
  await call('recordSale', {
    farmId: F,
    saleId: ulid(),
    saleDate: '2026-05-12',
    lines: [{ sizeClass: 'LARGE', quantity: 10, unitPrice: 140 }],
    allocations: [{ batchId: done['batchId'], state: 'HUSKED', quantity: 10 }],
    actualAmountReceived: 1300,
  });
  await call('recordProduceMovement', {
    batchId: done['batchId'],
    operationId: ulid(),
    transactionType: 'HOUSEHOLD_USE',
    quantity: 5,
    state: 'HUSKED',
    transactionDate: '2026-05-13',
  });
  await call('createInputItem', {
    farmId: F,
    itemId: ulid(),
    name: 'Urea',
    category: 'FERTILIZER',
    unit: 'KG',
    reorderLevel: 5,
    openingQuantity: 2,
  });
  const zoneId = ulid();
  await call('createZone', {
    farmId: F,
    zoneId,
    name: 'Polytunnel',
    zoneType: 'POLYTUNNEL',
  });
  const cycleId = ulid();
  await call('createCycle', {
    farmId: F,
    cycleId,
    name: 'Cucumber',
    cropName: 'Cucumber',
    zoneId,
  });
  await call('recordCycleHarvest', {
    cycleId,
    harvestId: ulid(),
    harvestDate: '2026-05-20',
    quantity: 12.5,
    unit: 'KG',
  });
});

describe('getAnalytics (#99, #100)', () => {
  it('coconut: totals, monthly trend, per-tree stats, rounds and samples', async () => {
    const r = await report();
    expect(r.coconut.totals).toMatchObject({
      nuts: 53,
      harvestRecords: 3,
      avgPerHarvest: 17.7,
    });
    expect(r.coconut.byMonth.find(m => m['month'] === '2026-03')).toMatchObject(
      { value: 18 }
    );
    expect(r.coconut.byMonth.find(m => m['month'] === '2026-05')).toMatchObject(
      { value: 35 }
    );
    expect(r.coconut.byMonth).toHaveLength(12);
    expect(r.coconut.trees.find(t => t['code'] === 'C-001')).toMatchObject({
      periodNuts: 38,
      harvestCount: 2,
      best: 20,
      latestSampleSize: 'LARGE',
      medianInterval: 63,
    });
    // Unknown-tree nuts count in the round total, never in any tree
    expect(r.coconut.rounds).toMatchObject({ rounds: 2, totalNuts: 83 });
    expect(r.coconut.samples).toMatchObject({ samples: 1 });
  });

  it('sales, stock and crops (CALC-014 scope travels with the figure)', async () => {
    const r = await report();
    expect(r.sales).toMatchObject({
      sales: 1,
      calculated: 1400,
      actual: 1300,
      difference: -100,
    });
    expect(r.sales['realizedPerCoconut']).toEqual({
      value: 130,
      sales: 1,
      nuts: 10,
    });
    expect(r.stock.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cropCode: 'COCONUT',
          total: 20,
          byState: { HUSKED: 20, DEHUSKED: 0 },
        }),
        expect.objectContaining({
          cropCode: 'CUCUMBER',
          unit: 'KG',
          total: 12.5,
          byState: { FRESH: 12.5 },
        }),
      ])
    );
    expect(r.stock.adjustments).toEqual([
      expect.objectContaining({
        transactionType: 'HOUSEHOLD_USE',
        quantity: 5,
      }),
    ]);
    expect(r.stock.lowStock).toEqual([
      expect.objectContaining({ name: 'Urea', quantity: 2 }),
    ]);
    expect(r.crops).toEqual([
      expect.objectContaining({
        cropName: 'Cucumber',
        total: 12.5,
        unit: 'KG',
      }),
    ]);
  });

  it('the period filters everything', async () => {
    const r = await report({ from: '2026-05-01', to: '2026-05-31' });
    expect(r.coconut.totals['nuts']).toBe(35);
    expect(r.coconut.byMonth).toHaveLength(1);
    expect(r.coconut.rounds['rounds']).toBe(1);
  });

  it('needs analytics.view; a viewer has it, an unknown farm does not exist', async () => {
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
        'getAnalytics',
        { farmId: F, from: '2026-01-01', to: '2026-12-31' },
        'viewer'
      )
    ).resolves.toBeTruthy();
    await expect(report({ farmId: ulid() })).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      report({ from: '2026-12-31', to: '2026-01-01' })
    ).rejects.toThrow(/^VALIDATION/);
  });
});
