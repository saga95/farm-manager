/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import { type ProduceTxn, balance } from '../../../../src/domain/inventory';
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
const byId = (id: string) => all().find(i => i['id'] === id)!;
let b1 = '';
let b2 = '';
let restaurant = '';
let treeNo = 0;

/** A completed round on `date` with `nuts` → its batch id. */
async function batchOf(date: string, nuts: number) {
  const { created } = (await call('bulkCreateTrees', {
    farmId: F,
    start: (treeNo += 1),
    count: 1,
    status: 'PRODUCING',
  })) as { created: { id: string }[] };
  const roundId = ulid();
  await call('createPluckingRound', {
    farmId: F,
    roundId,
    roundDate: date,
    plannedTreeIds: [created[0]!.id],
  });
  await call('recordTreeHarvest', {
    roundId,
    treeId: created[0]!.id,
    harvestId: ulid(),
    quantity: nuts,
  });
  return String(
    (await call('completePluckingRound', { roundId, expectedVersion: 1 }))[
      'batchId'
    ]
  );
}

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
          fromState: t['fromState'],
          toState: t['toState'],
        }) as ProduceTxn
    );
  expect(balance(txns).byState).toEqual(b['availableByState']);
  expect(balance(txns).total).toBe(b['available']);
}

const restaurantSale = (extra: Rec = {}) => ({
  farmId: F,
  saleId: ulid(),
  saleDate: '2026-10-04',
  buyerId: restaurant,
  lines: [
    { sizeClass: 'MEDIUM', quantity: 16, unitPrice: 120 },
    { sizeClass: 'LARGE', quantity: 4, unitPrice: 140 },
  ],
  allocations: [{ batchId: b1, state: 'HUSKED', quantity: 20 }],
  ...extra,
});

beforeEach(async () => {
  fake.reset();
  treeNo = 0;
  await call('createTenant', {
    name: 'X',
    defaultTimezone: 'Asia/Colombo',
    defaultCurrency: 'LKR',
    defaultLocale: 'en',
    farmId: F,
    farmName: 'F',
  });
  b1 = await batchOf('2026-10-01', 120);
  b2 = await batchOf('2026-10-02', 50);
  restaurant = ulid();
  await call('createBuyer', {
    buyerId: restaurant,
    name: 'Lake View Restaurant',
    preferredSizes: ['MEDIUM'],
  });
});

describe('recordSale (#85–#87)', () => {
  it('E2E-008/009, AC-SL-002..005: lines, calculated vs actual kept apart, stock reduced', async () => {
    const sale = await call(
      'recordSale',
      restaurantSale({
        actualAmountReceived: 2400,
        differenceReason: 'Rounded down',
      })
    );
    expect(sale).toMatchObject({
      status: 'COMPLETE',
      buyerName: 'Lake View Restaurant',
      totalQuantity: 20,
      calculatedAmount: 16 * 120 + 4 * 140,
      actualAmountReceived: 2400,
      difference: 2400 - 2480,
      differenceReason: 'Rounded down',
      currency: 'LKR',
    });
    expect((sale['lines'] as Rec[]).map(l => l['lineAmount'])).toEqual([
      1920, 560,
    ]);
    expect(byId(b1)).toMatchObject({
      available: 100,
      availableByState: { HUSKED: 100, DEHUSKED: 0 },
    });
    expectReconciled(b1);
  });

  it('AC-SL-006: a retried save takes stock exactly once', async () => {
    const input = restaurantSale();
    await call('recordSale', input);
    await call('recordSale', input);
    expect(all().filter(i => i['entityType'] === 'Sale')).toHaveLength(1);
    expect(all().filter(i => i['transactionType'] === 'SALE_OUT')).toHaveLength(
      1
    );
    expect(byId(b1)['available']).toBe(100);
  });

  it('AC-DH-003: selling 4 dehusked reduces only dehusked stock', async () => {
    await call('dehuskProduce', {
      batchId: b1,
      operationId: ulid(),
      quantity: 30,
      transactionDate: '2026-10-03',
    });
    await call(
      'recordSale',
      restaurantSale({
        lines: [{ quantity: 4, unitPrice: 150 }],
        allocations: [{ batchId: b1, state: 'DEHUSKED', quantity: 4 }],
      })
    );
    expect(byId(b1)['availableByState']).toEqual({ HUSKED: 90, DEHUSKED: 26 });
    expectReconciled(b1);
  });

  it('takes from several batches; accepts JSON-string arguments (AWSJSON)', async () => {
    await call(
      'recordSale',
      restaurantSale({
        lines: JSON.stringify([
          { sizeClass: 'SMALL', quantity: 130, unitPrice: 90 },
        ]),
        allocations: JSON.stringify([
          { batchId: b1, state: 'HUSKED', quantity: 100 },
          { batchId: b2, state: 'HUSKED', quantity: 30 },
        ]),
      })
    );
    expect(byId(b1)['available']).toBe(20);
    expect(byId(b2)['available']).toBe(20);
  });

  it('§13.5: overselling and unallocated nuts are refused; nothing changes', async () => {
    await expect(
      call(
        'recordSale',
        restaurantSale({
          lines: [{ quantity: 121, unitPrice: 100 }],
          allocations: [{ batchId: b1, state: 'HUSKED', quantity: 121 }],
        })
      )
    ).rejects.toThrow(/^VALIDATION: allocations: only 120 husked/);
    await expect(
      call(
        'recordSale',
        restaurantSale({
          allocations: [{ batchId: b1, state: 'HUSKED', quantity: 10 }],
        })
      )
    ).rejects.toThrow(/^VALIDATION: allocations: 20 nuts sold but 10/);
    expect(byId(b1)['available']).toBe(120);
    expect(all().filter(i => i['entityType'] === 'Sale')).toHaveLength(0);
  });

  it('needs sale.record: a viewer cannot sell', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#viewer',
      tenantId: T,
      userId: 'viewer',
      profileId: SYSTEM_PROFILE_IDS.viewer,
      status: 'ACTIVE',
    });
    await expect(
      call('recordSale', restaurantSale(), 'viewer')
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('editing and removing sales (#88)', () => {
  it('editing reconciles stock by the difference per batch and state', async () => {
    const sale = await call('recordSale', restaurantSale());
    const edited = await call('updateSale', {
      saleId: sale['id'],
      expectedVersion: 1,
      reason: 'Buyer returned 5',
      buyerId: restaurant,
      lines: [{ sizeClass: 'MEDIUM', quantity: 15, unitPrice: 120 }],
      allocations: [
        { batchId: b1, state: 'HUSKED', quantity: 10 },
        { batchId: b2, state: 'HUSKED', quantity: 5 },
      ],
      actualAmountReceived: 1800,
    });
    expect(edited).toMatchObject({
      version: 2,
      totalQuantity: 15,
      calculatedAmount: 1800,
      difference: 0,
    });
    expect(byId(b1)['available']).toBe(110);
    expect(byId(b2)['available']).toBe(45);
    expectReconciled(b1);
    expectReconciled(b2);
    expect(all().find(a => a['action'] === 'sale.update')).toMatchObject({
      details: expect.objectContaining({ reason: 'Buyer returned 5' }),
    });
  });

  it('removing returns the nuts; restoring takes them again; history hides removed sales', async () => {
    const sale = await call('recordSale', restaurantSale());
    const removed = await call('archiveSale', {
      saleId: sale['id'],
      expectedVersion: 1,
      reason: 'Duplicate',
    });
    expect(byId(b1)['available']).toBe(120);
    expect((await call('listSales', { farmId: F }))['sales'] as Rec[]).toEqual(
      []
    );
    expect(
      (await call('listSales', { farmId: F, includeDeleted: true }))[
        'sales'
      ] as Rec[]
    ).toHaveLength(1);
    await call('restoreSale', {
      saleId: sale['id'],
      expectedVersion: removed['version'],
    });
    expect(byId(b1)['available']).toBe(100);
    expectReconciled(b1);
  });
});

describe('sales history (#89)', () => {
  it('newest first, filtered by buyer and date, paginated', async () => {
    const other = ulid();
    await call('createBuyer', { buyerId: other, name: 'Kottu stall' });
    for (const [date, buyerId] of [
      ['2026-10-01', restaurant],
      ['2026-10-03', other],
      ['2026-10-05', restaurant],
      ['2026-10-07', restaurant],
    ] as const) {
      await call(
        'recordSale',
        restaurantSale({
          saleDate: date,
          buyerId,
          lines: [{ quantity: 1, unitPrice: 100 }],
          allocations: [{ batchId: b1, state: 'HUSKED', quantity: 1 }],
        })
      );
    }
    const page1 = await call('listSales', { farmId: F, limit: 2 });
    expect((page1['sales'] as Rec[]).map(s => s['saleDate'])).toEqual([
      '2026-10-07',
      '2026-10-05',
    ]);
    const page2 = await call('listSales', {
      farmId: F,
      limit: 2,
      nextToken: page1['nextToken'],
    });
    expect((page2['sales'] as Rec[]).map(s => s['saleDate'])).toEqual([
      '2026-10-03',
      '2026-10-01',
    ]);

    const mine = await call('listSales', {
      farmId: F,
      buyerId: restaurant,
      from: '2026-10-02',
      to: '2026-10-06',
    });
    expect((mine['sales'] as Rec[]).map(s => s['saleDate'])).toEqual([
      '2026-10-05',
    ]);
  });
});
