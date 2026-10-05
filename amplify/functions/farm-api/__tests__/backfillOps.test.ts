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

const all = () => [...fake.store.values()];
let trees: { id: string; code: string }[] = [];
const tree = (code: string) => trees.find(t => t.code === code)!.id;

const past = (
  roundDate: string,
  entries: [string, number, boolean?][],
  extra: Rec = {}
) =>
  call('backfillRound', {
    farmId: F,
    roundId: ulid(),
    roundDate,
    source: 'WHATSAPP_BACKFILL',
    entries: entries.map(([code, quantity, approximate]) => ({
      treeId: tree(code),
      harvestId: ulid(),
      quantity,
      approximate: approximate ?? false,
    })),
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
});

describe('backfill a past plucking round (#101, AC-BF-001..004)', () => {
  it('stores the original date, the source and approximate flags; unknown trees stay unattributed', async () => {
    const round = await past(
      '2026-03-01',
      [
        ['C-001', 20],
        ['C-002', 15, true],
      ],
      { unattributedQuantity: 40 }
    );
    expect(round).toMatchObject({
      status: 'COMPLETE',
      roundDate: '2026-03-01',
      source: 'WHATSAPP_BACKFILL',
      backfilled: true,
      totalNuts: 75,
      unattributedQuantity: 40,
    });
    expect(String(round['recordCreatedAt']).slice(0, 10)).not.toBe(
      '2026-03-01'
    );
    const harvests = all().filter(i => i['entityType'] === 'TreeHarvest');
    expect(harvests).toHaveLength(2);
    expect(harvests.find(h => h['treeId'] === tree('C-002'))).toMatchObject({
      recordQuality: 'APPROXIMATE',
      source: 'WHATSAPP_BACKFILL',
      harvestDate: '2026-03-01',
    });
    // Old nuts were sold back then: stock is untouched by default
    expect(all().filter(i => i['entityType'] === 'ProduceBatch')).toHaveLength(
      0
    );
    const hist = await call('getTreeHistory', { treeId: tree('C-001') });
    expect((hist['harvests'] as Rec[]).map(h => h['quantity'])).toEqual([20]);
  });

  it('a retried save never duplicates harvests; optional stock batch', async () => {
    const args = {
      farmId: F,
      roundId: ulid(),
      roundDate: '2026-03-01',
      source: 'MANUAL_BACKFILL',
      entries: [{ treeId: tree('C-001'), harvestId: ulid(), quantity: 20 }],
      addToStock: true,
    };
    await call('backfillRound', args);
    await call('backfillRound', args);
    expect(all().filter(i => i['entityType'] === 'TreeHarvest')).toHaveLength(
      1
    );
    expect(all().filter(i => i['entityType'] === 'ProduceBatch')).toEqual([
      expect.objectContaining({ available: 20, batchDate: '2026-03-01' }),
    ]);
  });

  it('refuses future dates, unknown trees, the same tree twice, and empty rounds', async () => {
    await expect(past('2999-01-01', [['C-001', 1]])).rejects.toThrow(
      /^VALIDATION: roundDate/
    );
    await expect(
      call('backfillRound', {
        farmId: F,
        roundId: ulid(),
        roundDate: '2026-03-01',
        source: 'WHATSAPP_BACKFILL',
        entries: [{ treeId: ulid(), harvestId: ulid(), quantity: 5 }],
      })
    ).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      past('2026-03-01', [
        ['C-001', 1],
        ['C-001', 2],
      ])
    ).rejects.toThrow(/^VALIDATION: entries/);
    await expect(past('2026-03-01', [])).rejects.toThrow(
      /^VALIDATION: entries/
    );
  });

  it('needs backfill.record: a farm helper cannot backfill', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#helper',
      tenantId: T,
      userId: 'helper',
      profileId: SYSTEM_PROFILE_IDS.farmHelper,
      status: 'ACTIVE',
    });
    await expect(
      call(
        'backfillRound',
        {
          farmId: F,
          roundId: ulid(),
          roundDate: '2026-03-01',
          source: 'WHATSAPP_BACKFILL',
          entries: [],
          unattributedQuantity: 5,
        },
        'helper'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('history feeds prediction, and can be excluded (AC-BF-005, E2E-007)', () => {
  it('backfilled intervals give an estimate; excluding records removes them', async () => {
    for (const d of ['2026-01-10', '2026-03-12', '2026-05-11', '2026-07-12'])
      await past(d, [['C-003', 20]]);
    const hist = await call('getTreeHistory', { treeId: tree('C-003') });
    expect(hist['prediction']).toMatchObject({
      intervalCount: 3,
      confidence: 'MEDIUM',
    });

    const [newest] = hist['harvests'] as Rec[];
    await call('setHarvestPredictionUse', {
      harvestId: newest!['id'],
      expectedVersion: newest!['version'],
      excludeFromPrediction: true,
    });
    const after = await call('getTreeHistory', { treeId: tree('C-003') });
    expect(after['prediction']).toMatchObject({
      intervalCount: 2,
      confidence: 'LOW',
    });
  });

  it('a whole unreliable round can be kept out of prediction', async () => {
    await past('2026-01-10', [['C-003', 20]], { excludeFromPrediction: true });
    await past('2026-03-12', [['C-003', 20]], { excludeFromPrediction: true });
    const hist = await call('getTreeHistory', { treeId: tree('C-003') });
    expect(hist['prediction']).toMatchObject({ confidence: 'NO_PREDICTION' });
    expect(hist['harvests']).toHaveLength(2);
  });
});

describe('backfill a past sale (#101, §18.2)', () => {
  it('records history without touching today’s stock; can be edited and removed', async () => {
    const sale = await call('backfillSale', {
      farmId: F,
      saleId: ulid(),
      saleDate: '2026-02-14',
      source: 'WHATSAPP_BACKFILL',
      lines: [
        { sizeClass: 'LARGE', quantity: 23, unitPrice: 140 },
        { sizeClass: 'MEDIUM', quantity: 16, unitPrice: 120 },
      ],
      actualAmountReceived: 5000,
    });
    expect(sale).toMatchObject({
      backfilled: true,
      source: 'WHATSAPP_BACKFILL',
      cropCode: 'COCONUT',
      quantityUnit: 'NUT',
      calculatedAmount: 5140,
      difference: -140,
      allocations: [],
    });
    expect(
      all().filter(i => i['entityType'] === 'ProduceInventoryTxn')
    ).toHaveLength(0);
    const edited = await call('updateSale', {
      saleId: sale['id'],
      expectedVersion: 1,
      lines: [{ sizeClass: 'LARGE', quantity: 23, unitPrice: 150 }],
      allocations: [],
    });
    expect(edited).toMatchObject({ calculatedAmount: 3450, allocations: [] });
    await call('archiveSale', { saleId: sale['id'], expectedVersion: 2 });
    expect((await call('listSales', { farmId: F }))['sales'] as Rec[]).toEqual(
      []
    );
  });

  it('live sales still must take nuts from stock', async () => {
    await expect(
      call('recordSale', {
        farmId: F,
        saleId: ulid(),
        saleDate: '2026-10-01',
        lines: [{ quantity: 1, unitPrice: 1 }],
        allocations: [],
      })
    ).rejects.toThrow(/^VALIDATION: allocations: 1 nuts sold but 0/);
  });
});
