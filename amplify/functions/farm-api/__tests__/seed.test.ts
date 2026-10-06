/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { seed, seedId } from '../../../../scripts/seed/dataset';
import * as api from '../../../../src/lib/api';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

/**
 * The validation dataset (#24) runs through the real client (src/lib/api.ts)
 * into the real farm-api handler: the seed obeys every server rule.
 */

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

let caller = 'user-a';
type Vars = Record<string, unknown>;
const op =
  (fieldName: string) =>
  async (vars: Vars = {}) => {
    try {
      const data = await handler({
        arguments: vars,
        identity: { sub: caller, claims: { email: `${caller}@farm.lk` } },
        info: { fieldName },
      } as unknown as AppSyncResolverEvent<Vars>);
      return { data: JSON.parse(JSON.stringify(data ?? null)) };
    } catch (e) {
      return { data: null, errors: [{ message: (e as Error).message }] };
    }
  };
const byName = new Proxy({}, { get: (_, name) => op(String(name)) });

jest.mock('aws-amplify/data', () => ({
  generateClient: () => ({ queries: byName, mutations: byName }),
}));

beforeAll(() => fake.reset());

describe('validation dataset (#24)', () => {
  it('ids are valid ULIDs, stable per user and key', () => {
    expect(seedId('u', 'k')).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(seedId('u', 'k')).toBe(seedId('u', 'k'));
    expect(seedId('u', 'k')).not.toBe(seedId('v', 'k'));
  });

  it('builds tenant A as §33 describes', async () => {
    caller = 'user-a';
    const a = await seed({ tenant: 'A', userId: caller });
    expect(a.skipped).toBe(0);

    const trees = await api.listTrees(a.tenantId, a.farmId);
    expect(trees).toHaveLength(50);
    expect(trees.map(t => t.code)).toContain('C-001');

    const zones = await api.listZones(a.tenantId, a.farmId);
    expect(zones.map(z => z.zoneType).sort()).toEqual([
      'COCONUT_AREA',
      'POLYTUNNEL',
    ]);
    expect(
      (await api.listPluckingRounds(a.tenantId, a.farmId)).length
    ).toBeGreaterThanOrEqual(6);
    expect(await api.listBuyers(a.tenantId)).toHaveLength(3);
    expect((await api.listSales(a.tenantId, a.farmId, {})).sales).toHaveLength(
      6
    );
    expect(await api.listInputItems(a.tenantId, a.farmId)).toHaveLength(3);
    const cycles = await api.listCycles(a.tenantId, a.farmId);
    expect(cycles).toEqual([
      expect.objectContaining({
        cropName: 'Chilli',
        status: 'HARVESTING',
        activityCount: 4,
        harvestCount: 2,
      }),
    ]);
    const tree = await api.getTree(a.tenantId, trees[0]!.id);
    expect(tree.sampleCount ?? 0).toBeGreaterThan(0);
  });

  it('is repeatable: a second run creates nothing new', async () => {
    caller = 'user-a';
    const before = fake.store.size;
    const snapshot = JSON.stringify([...fake.store.keys()].sort());
    const again = await seed({ tenant: 'A', userId: caller });
    expect(again.skipped).toBeGreaterThan(0);
    // No new records of any kind (harvests, batches, audit entries…)
    expect(fake.store.size).toBe(before);
    expect(JSON.stringify([...fake.store.keys()].sort())).toBe(snapshot);
  });

  it('tenant B is separate: same tree codes, no access to A', async () => {
    caller = 'user-a';
    const a = await seed({ tenant: 'A', userId: 'user-a' });
    caller = 'user-b';
    const b = await seed({ tenant: 'B', userId: caller });
    expect(b.tenantId).not.toBe(a.tenantId);
    expect(await api.listTrees(b.tenantId, b.farmId)).toHaveLength(10);
    await expect(api.listTrees(a.tenantId, a.farmId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
