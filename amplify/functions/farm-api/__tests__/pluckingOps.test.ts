/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import {
  nextPendingTree,
  roundEntries,
  roundTotal,
} from '../../../../src/domain/plucking';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const T2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2D';
const F = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';
const F2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2F';

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

type Round = {
  id: string;
  plannedTreeIds: string[];
  skippedTreeIds: string[];
  version: number;
  status: string;
};
type Harvest = {
  id: string;
  treeId: string;
  treeCode: string;
  quantity: number;
  version: number;
  harvestDate: string;
};

let trees: { id: string; code: string }[] = [];

beforeEach(async () => {
  fake.reset();
  for (const [tenantId, farmId, sub] of [
    [T, F, 'owner'],
    [T2, F2, 'other'],
  ] as const) {
    await call(
      'createTenant',
      {
        tenantId,
        name: 'X',
        defaultTimezone: 'Asia/Colombo',
        defaultCurrency: 'LKR',
        defaultLocale: 'en',
        farmId,
        farmName: 'F',
      },
      sub
    );
  }
  const res = (await call('bulkCreateTrees', {
    tenantId: T,
    farmId: F,
    start: 1,
    count: 12,
    status: 'PRODUCING',
  })) as {
    created: { id: string; code: string }[];
  };
  trees = res.created;
});

const tree = (code: string) => trees.find(t => t.code === code)!.id;

async function newRound(codes: string[]) {
  return (await call('createPluckingRound', {
    tenantId: T,
    farmId: F,
    roundId: ulid(),
    roundDate: '2026-10-04',
    plannedTreeIds: codes.map(tree),
    pluckerName: 'Sunil',
  })) as Round;
}

const record = (
  roundId: string,
  code: string,
  quantity: number,
  harvestId = ulid()
) =>
  call('recordTreeHarvest', {
    tenantId: T,
    roundId,
    treeId: tree(code),
    harvestId,
    quantity,
  }) as Promise<Harvest>;

describe('plan first, pluck in any order (PO 2026-10-04)', () => {
  it('creates a round with the selected trees in the plucker’s order (AC-PR-001)', async () => {
    const round = await newRound(['C-012', 'C-003', 'C-007']);
    expect(round).toMatchObject({
      status: 'IN_PROGRESS',
      plannedTreeIds: [tree('C-012'), tree('C-003'), tree('C-007')],
    });
  });

  it('records trees out of order and Save & Next follows the planned list', async () => {
    const round = await newRound(['C-012', 'C-003', 'C-007', 'C-001']);
    await record(round.id, 'C-007', 13); // plucker started in the middle
    await record(round.id, 'C-012', 18);
    const detail = (await call('getPluckingRound', {
      tenantId: T,
      roundId: round.id,
    })) as {
      round: Round;
      harvests: Harvest[];
    };
    const entries = roundEntries(
      detail.round.plannedTreeIds,
      detail.round.skippedTreeIds,
      detail.harvests
    );
    expect(entries.map(e => e.state)).toEqual([
      'RECORDED',
      'PENDING',
      'RECORDED',
      'PENDING',
    ]);
    expect(nextPendingTree(entries, tree('C-012'))).toBe(tree('C-003'));
    expect(roundTotal(detail.harvests)).toBe(31);
  });

  it('round total 13+18+9+20 = 60 (AC-PR-004)', async () => {
    const round = await newRound(['C-001', 'C-002', 'C-003', 'C-004']);
    for (const [code, q] of [
      ['C-001', 13],
      ['C-002', 18],
      ['C-003', 9],
      ['C-004', 20],
    ] as const) {
      await record(round.id, code, q);
    }
    const detail = (await call('getPluckingRound', {
      tenantId: T,
      roundId: round.id,
    })) as { harvests: Harvest[] };
    expect(roundTotal(detail.harvests)).toBe(60);
  });

  it('adds a tree on the spot and skips one without creating a zero harvest', async () => {
    let round = await newRound(['C-001', 'C-002']);
    round = (await call('updateRoundPlan', {
      tenantId: T,
      roundId: round.id,
      expectedVersion: round.version,
      addTreeIds: [tree('C-010')],
      skipTreeIds: [tree('C-002')],
    })) as Round;
    expect(round.plannedTreeIds).toContain(tree('C-010'));
    expect(round.skippedTreeIds).toEqual([tree('C-002')]);
    const harvests = [...fake.store.values()].filter(
      i => i['entityType'] === 'TreeHarvest'
    );
    expect(harvests).toHaveLength(0); // skip ≠ zero (DQ-001)
  });
});

describe('one tree once per round (§8.2), idempotent capture (ADR-0004)', () => {
  it('re-recording a tree edits the same harvest instead of adding another', async () => {
    const round = await newRound(['C-001']);
    const first = await record(round.id, 'C-001', 12);
    const second = await record(round.id, 'C-001', 14); // corrected count, new client id
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ quantity: 14, version: 2 });
    const harvests = [...fake.store.values()].filter(
      i => i['entityType'] === 'TreeHarvest'
    );
    expect(harvests).toHaveLength(1);
  });

  it('a retried save with the same id and values is a no-op replay', async () => {
    const round = await newRound(['C-001']);
    const hid = ulid();
    const a = await record(round.id, 'C-001', 12, hid);
    const b = await record(round.id, 'C-001', 12, hid);
    expect(b).toMatchObject({ id: a.id, version: 1 });
  });

  it('stores the harvest on the tree timeline with the round date', async () => {
    const round = await newRound(['C-005']);
    await record(round.id, 'C-005', 9);
    const raw = [...fake.store.values()].find(
      i => i['entityType'] === 'TreeHarvest'
    )!;
    expect(raw['PK']).toBe(`T#${T}#TREE#${tree('C-005')}`);
    expect(String(raw['SK'])).toMatch(/^H#2026-10-04#/);
    expect(raw).toMatchObject({
      quantityUnit: 'NUT',
      recordQuality: 'CONFIRMED',
      source: 'LIVE_APP',
      treeCode: 'C-005',
    });
  });
});

describe('validation and access', () => {
  it('rejects unplanned trees, bad quantities and inactive trees', async () => {
    const round = await newRound(['C-001']);
    await expect(record(round.id, 'C-002', 5)).rejects.toThrow(
      /^VALIDATION: treeId: add the tree/
    );
    await expect(record(round.id, 'C-001', 2.5)).rejects.toThrow(
      /^VALIDATION: quantity/
    );
    await expect(record(round.id, 'C-001', -1)).rejects.toThrow(
      /^VALIDATION: quantity/
    );
    await call('updateTree', {
      tenantId: T,
      farmId: F,
      code: 'C-011',
      expectedVersion: 1,
      status: 'DEAD',
    });
    await expect(newRound(['C-011'])).rejects.toThrow(
      /^VALIDATION: plannedTreeIds/
    );
  });

  it('a recorded tree cannot be skipped or removed', async () => {
    const round = await newRound(['C-001', 'C-002']);
    await record(round.id, 'C-001', 10);
    await expect(
      call('updateRoundPlan', {
        tenantId: T,
        roundId: round.id,
        expectedVersion: 1,
        skipTreeIds: [tree('C-001')],
      })
    ).rejects.toThrow(/^VALIDATION: skipTreeIds/);
  });

  it('another tenant cannot read or write the round', async () => {
    const round = await newRound(['C-001']);
    await expect(
      call('getPluckingRound', { tenantId: T2, roundId: round.id }, 'other')
    ).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      call(
        'recordTreeHarvest',
        {
          tenantId: T2,
          roundId: round.id,
          treeId: tree('C-001'),
          harvestId: ulid(),
          quantity: 3,
        },
        'other'
      )
    ).rejects.toThrow(/^NOT_FOUND/);
  });

  it('a farm helper can run a round; a viewer cannot record', async () => {
    for (const [userId, profileId] of [
      ['helper', SYSTEM_PROFILE_IDS.farmHelper],
      ['viewer', SYSTEM_PROFILE_IDS.viewer],
    ] as const) {
      fake.put({
        PK: `T#${T}`,
        SK: `MEMBER#${userId}`,
        tenantId: T,
        userId,
        profileId,
        status: 'ACTIVE',
      });
    }
    const round = (await call(
      'createPluckingRound',
      {
        tenantId: T,
        farmId: F,
        roundId: ulid(),
        roundDate: '2026-10-04',
        plannedTreeIds: [tree('C-001')],
      },
      'helper'
    )) as Round;
    await expect(
      call(
        'recordTreeHarvest',
        {
          tenantId: T,
          roundId: round.id,
          treeId: tree('C-001'),
          harvestId: ulid(),
          quantity: 7,
        },
        'helper'
      )
    ).resolves.toMatchObject({ quantity: 7 });
    await expect(
      call(
        'recordTreeHarvest',
        {
          tenantId: T,
          roundId: round.id,
          treeId: tree('C-001'),
          harvestId: ulid(),
          quantity: 8,
        },
        'viewer'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe('completePluckingRound → produce inventory (AC-PR-005/006, CALC-015)', () => {
  type Batch = {
    id: string;
    quantityReceived: number;
    available: number;
    sourceId: string;
    availableByState: Record<string, number>;
  };

  it('completes once, creates one coconut batch and one HARVEST_IN txn equal to the round total', async () => {
    const round = await newRound(['C-001', 'C-002', 'C-003']);
    await record(round.id, 'C-001', 13);
    await record(round.id, 'C-003', 20);
    const done = (await call('completePluckingRound', {
      tenantId: T,
      roundId: round.id,
      expectedVersion: 1,
    })) as Round & {
      totalNuts: number;
      batchId: string;
    };
    expect(done).toMatchObject({
      status: 'COMPLETE',
      totalNuts: 33,
      skippedTreeIds: [tree('C-002')],
    });

    const batches = (await call('listProduceBatches', {
      tenantId: T,
      farmId: F,
    })) as Batch[];
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      id: done.batchId,
      quantityReceived: 33,
      available: 33,
      sourceId: round.id,
    });
    expect(batches[0]!.availableByState).toEqual({ HUSKED: 33, DEHUSKED: 0 });

    const txns = [...fake.store.values()].filter(
      i => i['entityType'] === 'ProduceInventoryTxn'
    );
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({
      id: `HARVEST_IN#ROUND#${round.id}`,
      quantity: 33,
      transactionType: 'HARVEST_IN',
    });
  });

  it('a retried completion returns the completed round and never adds stock twice (AC-PR-006)', async () => {
    const round = await newRound(['C-001']);
    await record(round.id, 'C-001', 10);
    const a = (await call('completePluckingRound', {
      tenantId: T,
      roundId: round.id,
      expectedVersion: 1,
    })) as Round;
    const b = (await call('completePluckingRound', {
      tenantId: T,
      roundId: round.id,
      expectedVersion: 1,
    })) as Round;
    expect(b).toMatchObject({ id: a.id, status: 'COMPLETE' });
    expect(
      [...fake.store.values()].filter(i => i['entityType'] === 'ProduceBatch')
    ).toHaveLength(1);
    expect(
      [...fake.store.values()].filter(
        i => i['entityType'] === 'ProduceInventoryTxn'
      )
    ).toHaveLength(1);
  });

  it('closes the round for further capture', async () => {
    const round = await newRound(['C-001', 'C-002']);
    await record(round.id, 'C-001', 10);
    await call('completePluckingRound', {
      tenantId: T,
      roundId: round.id,
      expectedVersion: 1,
    });
    await expect(record(round.id, 'C-002', 4)).rejects.toThrow(
      /^VALIDATION: Round is no longer open/
    );
  });

  it('refuses to complete a round with no recorded trees', async () => {
    const round = await newRound(['C-001']);
    await expect(
      call('completePluckingRound', {
        tenantId: T,
        roundId: round.id,
        expectedVersion: 1,
      })
    ).rejects.toThrow(/^VALIDATION: Record at least one tree/);
  });

  it('rejects a stale version (someone edited the plan meanwhile)', async () => {
    const round = await newRound(['C-001', 'C-002']);
    await record(round.id, 'C-001', 10);
    await call('updateRoundPlan', {
      tenantId: T,
      roundId: round.id,
      expectedVersion: 1,
      skipTreeIds: [tree('C-002')],
    });
    await expect(
      call('completePluckingRound', {
        tenantId: T,
        roundId: round.id,
        expectedVersion: 1,
      })
    ).rejects.toThrow(/^CONFLICT/);
  });

  it('a round whose recorded trees all yielded 0 completes without a batch', async () => {
    const round = await newRound(['C-001']);
    await record(round.id, 'C-001', 0);
    const done = (await call('completePluckingRound', {
      tenantId: T,
      roundId: round.id,
      expectedVersion: 1,
    })) as {
      totalNuts: number;
      batchId?: string | null;
    };
    expect(done.totalNuts).toBe(0);
    expect(done.batchId ?? null).toBeNull();
    expect(
      [...fake.store.values()].filter(i => i['entityType'] === 'ProduceBatch')
    ).toHaveLength(0);
  });
});
