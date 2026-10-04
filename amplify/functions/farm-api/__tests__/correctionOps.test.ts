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

let trees: { id: string; code: string }[] = [];
const tree = (code: string) => trees.find(t => t.code === code)!.id;
const all = () => [...fake.store.values()];
const byType = (type: string) => all().filter(i => i['entityType'] === type);

/** A round with C-001: 20 and C-002: 15, optionally completed. */
async function round(complete = true) {
  const roundId = ulid();
  await call('createPluckingRound', {
    farmId: F,
    roundId,
    roundDate: '2026-10-01',
    plannedTreeIds: [tree('C-001'), tree('C-002')],
  });
  const h1 = await call('recordTreeHarvest', {
    roundId,
    treeId: tree('C-001'),
    harvestId: ulid(),
    quantity: 20,
  });
  const h2 = await call('recordTreeHarvest', {
    roundId,
    treeId: tree('C-002'),
    harvestId: ulid(),
    quantity: 15,
  });
  if (complete) {
    const r = await call('getPluckingRound', { roundId });
    await call('completePluckingRound', {
      roundId,
      expectedVersion: (r['round'] as Rec)['version'],
    });
  }
  return { roundId, h1, h2 };
}

function batch() {
  const [b] = byType('ProduceBatch');
  return b!;
}
/** CALC-010: the cached batch balance must equal the sum of its transactions. */
function expectReconciled() {
  const b = batch();
  const txns = byType('ProduceInventoryTxn')
    .filter(t => t['batchId'] === b['id'])
    .map(
      t =>
        ({
          type: t['transactionType'],
          quantity: t['quantity'],
          state: t['state'],
        }) as ProduceTxn
    );
  expect(balance(txns).total).toBe(b['available']);
  expect(balance(txns).byState).toEqual(b['availableByState']);
}
const roundItem = (roundId: string) => all().find(i => i['id'] === roundId)!;

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

describe('correctTreeHarvest on a completed round (#56, AC-PR-007)', () => {
  it('books the difference to stock, keeps the previous quantity and audits it', async () => {
    const { roundId, h1 } = await round();
    expect(batch()).toMatchObject({ available: 35 });
    const fixed = await call('correctTreeHarvest', {
      harvestId: h1['id'],
      expectedVersion: h1['version'],
      quantity: 25,
      reason: 'Miscounted',
    });
    expect(fixed).toMatchObject({
      quantity: 25,
      previousQuantity: 20,
      updatedBy: 'owner',
    });
    expect(batch()).toMatchObject({ available: 40, quantityReceived: 40 });
    expect(roundItem(roundId)['totalNuts']).toBe(40);
    expect(
      byType('ProduceInventoryTxn').map(t => [
        t['transactionType'],
        t['quantity'],
      ])
    ).toEqual(
      expect.arrayContaining([
        ['HARVEST_IN', 35],
        ['ADJUSTMENT_IN', 5],
      ])
    );
    expect(
      byType('AuditLog').find(a => a['action'] === 'harvest.correct')
    ).toMatchObject({
      details: expect.objectContaining({ delta: 5, reason: 'Miscounted' }),
    });
    expectReconciled();
  });

  it('a lower count takes nuts out; a retry never books twice', async () => {
    const { h1 } = await round();
    const args = {
      harvestId: h1['id'],
      expectedVersion: h1['version'],
      quantity: 12,
    };
    await call('correctTreeHarvest', args);
    await call('correctTreeHarvest', args);
    expect(batch()).toMatchObject({ available: 27 });
    expect(
      byType('ProduceInventoryTxn').filter(
        t => t['transactionType'] === 'ADJUSTMENT_OUT'
      )
    ).toHaveLength(1);
    expectReconciled();
  });

  it('a stale version is a conflict; stock already used cannot be taken back', async () => {
    const { h1 } = await round();
    await call('correctTreeHarvest', {
      harvestId: h1['id'],
      expectedVersion: h1['version'],
      quantity: 21,
    });
    await expect(
      call('correctTreeHarvest', {
        harvestId: h1['id'],
        expectedVersion: h1['version'],
        quantity: 22,
      })
    ).rejects.toThrow(/^CONFLICT/);

    const b = batch();
    fake.put({
      ...b,
      available: 5,
      availableByState: { HUSKED: 5, DEHUSKED: 0 },
    }); // 31 sold meanwhile
    const latest = all().find(i => i['id'] === h1['id'])!;
    await expect(
      call('correctTreeHarvest', {
        harvestId: h1['id'],
        expectedVersion: latest['version'],
        quantity: 0,
      })
    ).rejects.toThrow(/^CONFLICT: stock: only 5/);
  });

  it('needs record.edit: a farm helper cannot correct a completed round', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#helper',
      tenantId: T,
      userId: 'helper',
      profileId: SYSTEM_PROFILE_IDS.farmHelper,
      status: 'ACTIVE',
    });
    const { h1 } = await round();
    await expect(
      call(
        'correctTreeHarvest',
        { harvestId: h1['id'], expectedVersion: h1['version'], quantity: 1 },
        'helper'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('soft delete & restore a harvest (#57, DQ-005)', () => {
  it('completed round: removed from totals, stock and history; restore puts it back', async () => {
    const { roundId, h1 } = await round();
    const removed = await call('archiveTreeHarvest', {
      harvestId: h1['id'],
      expectedVersion: h1['version'],
      reason: 'Wrong tree',
    });
    expect(removed['deletedAt']).toBeTruthy();
    expect(batch()).toMatchObject({ available: 15 });
    expect(roundItem(roundId)['totalNuts']).toBe(15);
    const detail = await call('getPluckingRound', { roundId });
    expect((detail['harvests'] as Rec[]).map(h => h['id'])).not.toContain(
      h1['id']
    );
    expect((detail['removedHarvests'] as Rec[]).map(h => h['id'])).toEqual([
      h1['id'],
    ]);
    const hist = await call('getTreeHistory', { treeId: tree('C-001') });
    expect(hist['harvests']).toEqual([]);
    expectReconciled();

    await call('restoreTreeHarvest', {
      harvestId: h1['id'],
      expectedVersion: removed['version'],
    });
    expect(batch()).toMatchObject({ available: 35 });
    expect(roundItem(roundId)['totalNuts']).toBe(35);
    expect(
      (await call('getTreeHistory', { treeId: tree('C-001') }))['harvests']
    ).toHaveLength(1);
    expectReconciled();
  });

  it('open round: frees the tree to be recorded again; restoring then conflicts', async () => {
    const { roundId, h1 } = await round(false);
    const removed = await call('archiveTreeHarvest', {
      harvestId: h1['id'],
      expectedVersion: h1['version'],
    });
    await call('recordTreeHarvest', {
      roundId,
      treeId: tree('C-001'),
      harvestId: ulid(),
      quantity: 18,
    });
    await expect(
      call('restoreTreeHarvest', {
        harvestId: h1['id'],
        expectedVersion: removed['version'],
      })
    ).rejects.toThrow(/^CONFLICT: tree/);
    expect(byType('ProduceBatch')).toHaveLength(0);
  });
});

describe('soft delete & restore a round (#57)', () => {
  it('removes the round, its stock and its harvests; restore brings them back', async () => {
    const { roundId } = await round();
    const r = roundItem(roundId);
    const removed = await call('archivePluckingRound', {
      roundId,
      expectedVersion: r['version'],
      reason: 'Duplicate',
    });
    expect(removed['deletedAt']).toBeTruthy();
    expect(await call('listPluckingRounds', { farmId: F })).toEqual([]);
    expect(
      await call('listPluckingRounds', { farmId: F, includeDeleted: true })
    ).toHaveLength(1);
    expect(batch()).toMatchObject({ available: 0, status: 'VOID' });
    expect(
      (await call('getTreeHistory', { treeId: tree('C-002') }))['harvests']
    ).toEqual([]);
    expectReconciled();
    await expect(
      call('recordTreeHarvest', {
        roundId,
        treeId: tree('C-001'),
        harvestId: ulid(),
        quantity: 1,
      })
    ).rejects.toThrow(/^VALIDATION: Round was removed/);

    await call('restorePluckingRound', {
      roundId,
      expectedVersion: removed['version'],
    });
    expect(batch()).toMatchObject({ available: 35, status: 'AVAILABLE' });
    expect(
      (await call('getTreeHistory', { treeId: tree('C-002') }))['harvests']
    ).toHaveLength(1);
    expectReconciled();
  });

  it('refuses when the round’s stock was already used', async () => {
    const { roundId } = await round();
    fake.put({
      ...batch(),
      available: 30,
      availableByState: { HUSKED: 30, DEHUSKED: 0 },
    });
    await expect(
      call('archivePluckingRound', {
        roundId,
        expectedVersion: roundItem(roundId)['version'],
      })
    ).rejects.toThrow(/^CONFLICT: stock/);
  });

  it('an open round can be removed without touching stock', async () => {
    const { roundId } = await round(false);
    await call('archivePluckingRound', {
      roundId,
      expectedVersion: roundItem(roundId)['version'],
    });
    expect(byType('ProduceBatch')).toHaveLength(0);
    expect(await call('listPluckingRounds', { farmId: F })).toEqual([]);
  });
});
