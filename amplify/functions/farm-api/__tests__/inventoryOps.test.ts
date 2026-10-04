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

let batchId = '';
const batch = () => [...fake.store.values()].find(i => i['id'] === batchId)!;
const txns = () =>
  [...fake.store.values()].filter(
    i => i['entityType'] === 'ProduceInventoryTxn'
  );
function expectReconciled() {
  const b = balance(
    txns().map(
      t =>
        ({
          type: t['transactionType'],
          quantity: t['quantity'],
          state: t['state'],
          fromState: t['fromState'],
          toState: t['toState'],
        }) as ProduceTxn
    )
  );
  expect(b.byState).toEqual(batch()['availableByState']);
  expect(b.total).toBe(batch()['available']);
}

const move = (type: string, quantity: number, extra: Rec = {}, sub = 'owner') =>
  call(
    'recordProduceMovement',
    {
      batchId,
      operationId: ulid(),
      transactionType: type,
      quantity,
      state: 'HUSKED',
      transactionDate: '2026-10-04',
      ...extra,
    },
    sub
  );
const dehusk = (quantity: number, operationId = ulid()) =>
  call('dehuskProduce', {
    batchId,
    operationId,
    quantity,
    transactionDate: '2026-10-04',
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
    roundDate: '2026-10-01',
    plannedTreeIds: [created[0]!.id],
  });
  await call('recordTreeHarvest', {
    roundId,
    treeId: created[0]!.id,
    harvestId: ulid(),
    quantity: 120,
  });
  const done = await call('completePluckingRound', {
    roundId,
    expectedVersion: 1,
  });
  batchId = String(done['batchId']);
});

describe('operational dehusking (#78, §41.9)', () => {
  it('AC-DH-002: 30 of 120 → 90 husked + 30 dehusked; total conserved', async () => {
    const res = await dehusk(30);
    expect((res['batch'] as Rec)['availableByState']).toEqual({
      HUSKED: 90,
      DEHUSKED: 30,
    });
    expect(batch()).toMatchObject({
      available: 120,
      availableByState: { HUSKED: 90, DEHUSKED: 30 },
    });
    expect(res['transaction']).toMatchObject({
      transactionType: 'PROCESSING',
      fromState: 'HUSKED',
      toState: 'DEHUSKED',
    });
    expectReconciled();
  });

  it('AC-DH-004: retrying the same dehusk does not move stock twice', async () => {
    const op = ulid();
    await dehusk(30, op);
    await dehusk(30, op);
    expect(batch()['availableByState']).toEqual({ HUSKED: 90, DEHUSKED: 30 });
    expect(
      txns().filter(t => t['transactionType'] === 'PROCESSING')
    ).toHaveLength(1);
  });

  it('AC-DH-001: recording a sample never changes batch state', async () => {
    const harvest = [...fake.store.values()].find(
      i => i['entityType'] === 'TreeHarvest'
    )!;
    await call('recordCoconutSample', {
      harvestId: harvest['id'],
      sampleId: ulid(),
      sizeClass: 'LARGE',
    });
    expect(batch()['availableByState']).toEqual({ HUSKED: 120, DEHUSKED: 0 });
  });

  it('cannot dehusk more than is husked', async () => {
    await expect(dehusk(121)).rejects.toThrow(
      /^VALIDATION: quantity: only 120 husked/
    );
  });
});

describe('stock movements (#77, AC-IN-002/003/004)', () => {
  it('household use, damage and waste reduce the chosen state', async () => {
    await dehusk(10);
    await move('HOUSEHOLD_USE', 5);
    await move('DAMAGE', 2, { state: 'DEHUSKED' });
    await move('WASTE', 3);
    expect(batch()).toMatchObject({
      available: 110,
      availableByState: { HUSKED: 102, DEHUSKED: 8 },
    });
    expectReconciled();
  });

  it('never silently below zero', async () => {
    await expect(
      move('HOUSEHOLD_USE', 1, { state: 'DEHUSKED' })
    ).rejects.toThrow(/only 0 dehusked/);
    await move('WASTE', 120);
    expect(batch()).toMatchObject({ available: 0, status: 'DEPLETED' });
    expect(
      await call('listProduceBatches', { farmId: F, availableOnly: true })
    ).toEqual([]);
  });

  it('adjustments need a reason', async () => {
    await expect(move('ADJUSTMENT_OUT', 4)).rejects.toThrow(
      /^VALIDATION: notes/
    );
    await move('ADJUSTMENT_OUT', 4, { notes: 'Recount at the store' });
    await move('ADJUSTMENT_IN', 1, { notes: 'Found one more' });
    expect(batch()['available']).toBe(117);
    expectReconciled();
  });

  it('needs inventory.adjust: a viewer cannot move stock', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#viewer',
      tenantId: T,
      userId: 'viewer',
      profileId: SYSTEM_PROFILE_IDS.viewer,
      status: 'ACTIVE',
    });
    await expect(move('WASTE', 1, {}, 'viewer')).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('batch detail (#79)', () => {
  it('movement history is newest first and paginated', async () => {
    for (let i = 0; i < 4; i += 1)
      await move('HOUSEHOLD_USE', 1, { transactionDate: `2026-10-0${i + 2}` });
    const first = await call('getProduceBatch', { batchId, limit: 3 });
    expect(
      (first['transactions'] as Rec[]).map(t => t['transactionDate'])
    ).toEqual(['2026-10-05', '2026-10-04', '2026-10-03']);
    expect(first['nextToken']).toBeTruthy();
    const second = await call('getProduceBatch', {
      batchId,
      limit: 3,
      nextToken: first['nextToken'],
    });
    expect(
      (second['transactions'] as Rec[]).map(t => t['transactionType'])
    ).toEqual(['HOUSEHOLD_USE', 'HARVEST_IN']);
    expect(second['nextToken']).toBeNull();
  });

  it('rejects a token from another partition', async () => {
    const forged = Buffer.from(
      JSON.stringify({ PK: 'T#other#B#x', SK: 'TX#' })
    ).toString('base64url');
    await expect(
      call('getProduceBatch', { batchId, nextToken: forged })
    ).rejects.toThrow(/^VALIDATION: nextToken/);
  });
});
