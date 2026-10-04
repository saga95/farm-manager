/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import { type ProduceTxn, balance } from '../../../../src/domain/inventory';
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
const byId = (id: string) => all().find(i => i['id'] === id)!;
let cycleId = '';

const harvest = (
  quantity: number,
  unit = 'KG',
  date = '2026-04-10',
  harvestId = ulid()
) =>
  call('recordCycleHarvest', {
    cycleId,
    harvestId,
    harvestDate: date,
    quantity,
    unit,
  });

function expectReconciled(batchId: string) {
  const b = byId(batchId);
  const txns = all()
    .filter(
      t => t['entityType'] === 'ProduceInventoryTxn' && t['batchId'] === batchId
    )
    .map(
      t =>
        ({
          type: t['transactionType'],
          quantity: t['quantity'],
          state: t['state'],
        }) as ProduceTxn
    );
  const bal = balance(txns, ['FRESH']);
  expect(bal.byState).toEqual(b['availableByState']);
  expect(bal.total).toBe(b['available']);
}

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
  const zoneId = ulid();
  await call('createZone', {
    farmId: F,
    zoneId,
    name: 'Polytunnel',
    zoneType: 'POLYTUNNEL',
  });
  cycleId = ulid();
  await call('createCycle', {
    farmId: F,
    cycleId,
    name: 'Cucumber 2026-02',
    cropName: 'Cucumber',
    zoneId,
    estimatedPlantCount: 120,
  });
});

describe('polytunnel harvest → produce stock (#95)', () => {
  it('E2E-010 / AC-PT-003/004: a 12.5 kg harvest becomes a fresh stock batch', async () => {
    const h = await harvest(12.5);
    expect(h).toMatchObject({
      quantity: 12.5,
      unit: 'KG',
      cropCode: 'CUCUMBER',
    });
    const batch = byId(h['batchId'] as string);
    expect(batch).toMatchObject({
      cropCode: 'CUCUMBER',
      cropName: 'Cucumber',
      unit: 'KG',
      available: 12.5,
      availableByState: { FRESH: 12.5 },
      sourceType: 'GENERIC_HARVEST',
    });
    expect(all().some(i => i['entityType'] === 'Tree')).toBe(false);
    const listed = (await call('listProduceBatches', {
      farmId: F,
    })) as unknown as Rec[];
    expect(listed.map(b => b['cropCode'])).toEqual(['CUCUMBER']);
    expectReconciled(batch['id'] as string);
  });

  it('AC-PC-003: many harvests per cycle; totals per unit; the cycle moves to harvesting', async () => {
    await harvest(12.5);
    await harvest(8.25, 'KG', '2026-04-14');
    await harvest(40, 'COUNT', '2026-04-15');
    const detail = await call('getCycle', { cycleId });
    expect((detail['harvests'] as Rec[]).map(h => h['harvestDate'])).toEqual([
      '2026-04-15',
      '2026-04-14',
      '2026-04-10',
    ]);
    expect(detail['cycle']).toMatchObject({
      status: 'HARVESTING',
      harvestCount: 3,
      harvestTotals: { KG: 20.75, COUNT: 40 },
      lastHarvestAt: '2026-04-15',
    });
  });

  it('a retried save records once; counts must be whole', async () => {
    const harvestId = ulid();
    await harvest(5, 'KG', '2026-04-10', harvestId);
    await harvest(5, 'KG', '2026-04-10', harvestId);
    expect(all().filter(i => i['entityType'] === 'ProduceBatch')).toHaveLength(
      1
    );
    await expect(harvest(2.5, 'COUNT')).rejects.toThrow(
      /^VALIDATION: quantity: whole items/
    );
  });

  it('fresh produce cannot be dehusked; movements use decimals', async () => {
    const h = await harvest(12.5);
    const batchId = h['batchId'] as string;
    await expect(
      call('dehuskProduce', {
        batchId,
        operationId: ulid(),
        quantity: 1,
        transactionDate: '2026-04-11',
      })
    ).rejects.toThrow(/^VALIDATION: batch: only coconuts/);
    await call('recordProduceMovement', {
      batchId,
      operationId: ulid(),
      transactionType: 'HOUSEHOLD_USE',
      quantity: 1.25,
      state: 'FRESH',
      transactionDate: '2026-04-11',
    });
    expect(byId(batchId)['available']).toBe(11.25);
    await expect(
      call('recordProduceMovement', {
        batchId,
        operationId: ulid(),
        transactionType: 'WASTE',
        quantity: 1,
        state: 'HUSKED',
        transactionDate: '2026-04-11',
      })
    ).rejects.toThrow(/^VALIDATION: state/);
    expectReconciled(batchId);
  });
});

describe('selling polytunnel produce (#96, AC-PT-005, E2E-011)', () => {
  it('the same Sales module sells kg from a fresh batch, without size lines', async () => {
    const h = await harvest(12.5);
    const batchId = h['batchId'] as string;
    const sale = await call('recordSale', {
      farmId: F,
      saleId: ulid(),
      saleDate: '2026-04-12',
      lines: [{ sizeClass: 'LARGE', quantity: 10.5, unitPrice: 480 }],
      allocations: [{ batchId, state: 'FRESH', quantity: 10.5 }],
    });
    expect(sale).toMatchObject({
      cropCode: 'CUCUMBER',
      quantityUnit: 'KG',
      totalQuantity: 10.5,
      calculatedAmount: 5040,
    });
    expect((sale['lines'] as Rec[])[0]).toMatchObject({
      sizeClass: null,
      lineAmount: 5040,
    });
    expect(byId(batchId)['available']).toBe(2);
    expectReconciled(batchId);
  });

  it('one sale is one crop; nuts stay whole', async () => {
    const h = await harvest(12.5);
    const { created } = (await call('bulkCreateTrees', {
      farmId: F,
      start: 1,
      count: 1,
      status: 'PRODUCING',
    })) as {
      created: { id: string }[];
    };
    const roundId = ulid();
    await call('createPluckingRound', {
      farmId: F,
      roundId,
      roundDate: '2026-04-01',
      plannedTreeIds: [created[0]!.id],
    });
    await call('recordTreeHarvest', {
      roundId,
      treeId: created[0]!.id,
      harvestId: ulid(),
      quantity: 20,
    });
    const coconut = String(
      (await call('completePluckingRound', { roundId, expectedVersion: 1 }))[
        'batchId'
      ]
    );
    await expect(
      call('recordSale', {
        farmId: F,
        saleId: ulid(),
        saleDate: '2026-04-12',
        lines: [{ quantity: 3, unitPrice: 100 }],
        allocations: [
          { batchId: h['batchId'], state: 'FRESH', quantity: 1 },
          { batchId: coconut, state: 'HUSKED', quantity: 2 },
        ],
      })
    ).rejects.toThrow(/^VALIDATION: allocations: one sale is for one crop/);
    await expect(
      call('recordSale', {
        farmId: F,
        saleId: ulid(),
        saleDate: '2026-04-12',
        lines: [{ quantity: 1.5, unitPrice: 100 }],
        allocations: [{ batchId: coconut, state: 'HUSKED', quantity: 1.5 }],
      })
    ).rejects.toThrow(/^VALIDATION: quantity: whole nuts/);
  });
});
