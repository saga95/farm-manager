/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const F = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';

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

let trees: { id: string; code: string }[] = [];
const tree = (code: string) => trees.find(t => t.code === code)!.id;

/** Run a round on `date`: record the given codes with counts. */
async function round(date: string, counts: Record<string, number>) {
  const roundId = ulid();
  await call('createPluckingRound', {
    tenantId: T,
    farmId: F,
    roundId,
    roundDate: date,
    plannedTreeIds: Object.keys(counts).map(tree),
  });
  for (const [code, quantity] of Object.entries(counts)) {
    await call('recordTreeHarvest', {
      tenantId: T,
      roundId,
      treeId: tree(code),
      harvestId: ulid(),
      quantity,
    });
  }
  return roundId;
}

beforeEach(async () => {
  fake.reset();
  await call('createTenant', {
    tenantId: T,
    name: 'X',
    defaultTimezone: 'Asia/Colombo',
    defaultCurrency: 'LKR',
    defaultLocale: 'en',
    farmId: F,
    farmName: 'F',
  });
  const res = (await call('bulkCreateTrees', {
    tenantId: T,
    farmId: F,
    start: 1,
    count: 4,
    status: 'PRODUCING',
  })) as {
    created: { id: string; code: string }[];
  };
  trees = res.created;
});

type History = {
  harvests: { harvestDate: string; quantity: number }[];
  summary: {
    harvestCount: number;
    lifetimeTotal: number;
    averagePerHarvest: number | null;
    daysSinceLast: number | null;
  };
  prediction: {
    confidence: string;
    intervalCount: number;
    medianIntervalDays: number | null;
    estimateDate: string | null;
  };
};

describe('getTreeHistory (#59, §7.2)', () => {
  it('returns the harvest timeline (newest first), summary and explainable prediction', async () => {
    await round('2026-01-10', { 'C-001': 20 });
    await round('2026-03-11', { 'C-001': 14 });
    await round('2026-05-10', { 'C-001': 26 });
    await round('2026-07-10', { 'C-001': 18 });
    const h = (await call('getTreeHistory', {
      tenantId: T,
      treeId: tree('C-001'),
      today: '2026-08-01',
    })) as History;
    expect(h.harvests.map(x => x.harvestDate)).toEqual([
      '2026-07-10',
      '2026-05-10',
      '2026-03-11',
      '2026-01-10',
    ]);
    expect(h.summary).toMatchObject({
      harvestCount: 4,
      lifetimeTotal: 78,
      averagePerHarvest: 19.5,
      daysSinceLast: 22,
    });
    expect(h.prediction).toMatchObject({
      confidence: 'MEDIUM',
      intervalCount: 3,
      medianIntervalDays: 60,
    });
    expect(h.prediction.estimateDate).toBe('2026-09-08');
  });

  it('a tree with no harvests has "no history", not zeros', async () => {
    const h = (await call('getTreeHistory', {
      tenantId: T,
      treeId: tree('C-002'),
    })) as History;
    expect(h.harvests).toEqual([]);
    expect(h.summary).toMatchObject({
      harvestCount: 0,
      averagePerHarvest: null,
      daysSinceLast: null,
    });
    expect(h.prediction.confidence).toBe('NO_PREDICTION');
  });

  it('keeps the tree snapshot in sync when a count is corrected', async () => {
    const r = await round('2026-01-10', { 'C-003': 10 });
    await call('recordTreeHarvest', {
      tenantId: T,
      roundId: r,
      treeId: tree('C-003'),
      harvestId: ulid(),
      quantity: 12,
    });
    const raw = [...fake.store.values()].find(i => i['id'] === tree('C-003'))!;
    expect(raw).toMatchObject({
      lastQuantity: 12,
      harvestCount: 1,
      lifetimeTotal: 12,
      lastHarvestDate: '2026-01-10',
    });
  });
});

describe('listDueTrees (§10.2/§10.3)', () => {
  type Due = {
    tree: { code: string };
    bucket: string;
    daysSinceLast: number | null;
  };

  it('groups producing trees and sorts by predicted date', async () => {
    // C-001: every ~60 days, last 2026-05-10 → due ~2026-07-09 (overdue on 2026-08-01)
    await round('2026-01-10', { 'C-001': 20, 'C-002': 10 });
    await round('2026-03-11', { 'C-001': 14 });
    await round('2026-05-10', { 'C-001': 26 });
    // C-002: two pluckings 90 days apart, last 2026-04-10 → estimate 2026-07-09 too, but LOW
    await round('2026-04-10', { 'C-002': 12 });
    // C-003: once only → not enough history; C-004: never plucked
    await round('2026-06-01', { 'C-003': 9 });

    const due = (await call('listDueTrees', {
      tenantId: T,
      farmId: F,
      today: '2026-08-01',
    })) as Due[];
    const byCode = Object.fromEntries(due.map(d => [d.tree.code, d]));
    expect(byCode['C-001']!.bucket).toBe('OVERDUE');
    expect(byCode['C-003']!.bucket).toBe('NOT_ENOUGH_HISTORY');
    expect(byCode['C-004']!.bucket).toBe('NOT_ENOUGH_HISTORY');
    expect(byCode['C-004']!.daysSinceLast).toBeNull();
    expect(byCode['C-003']!.daysSinceLast).toBe(61);
    // no-history trees are listed after trees with estimates
    expect(due.map(d => d.bucket).slice(-2)).toEqual([
      'NOT_ENOUGH_HISTORY',
      'NOT_ENOUGH_HISTORY',
    ]);
  });

  it('only lists PRODUCING trees', async () => {
    await call('updateTree', {
      tenantId: T,
      farmId: F,
      code: 'C-004',
      expectedVersion: 1,
      status: 'YOUNG',
    });
    const due = (await call('listDueTrees', {
      tenantId: T,
      farmId: F,
      today: '2026-08-01',
    })) as Due[];
    expect(due.map(d => d.tree.code)).not.toContain('C-004');
  });
});
