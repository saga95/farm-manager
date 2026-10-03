/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const T2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2D';
const F = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';
const F2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2F';
const TREE = '01J9ZQ3M5K8R2V7W4X6Y0A1B2G';
const TREE2 = '01J9ZQ3M5K8R2V7W4X6Y0A1B2H';

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

type Tree = { id: string; code: string; status: string; version: number };

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
        farmName: 'Farm',
      },
      sub
    );
  }
});

describe('bulkCreateTrees (FR-CN-001, AC-CN-001/002)', () => {
  it('creates 50 unique trees C-001…C-050 in one farm', async () => {
    const res = (await call('bulkCreateTrees', {
      tenantId: T,
      farmId: F,
      start: 1,
      count: 50,
      status: 'PRODUCING',
    })) as {
      created: { code: string }[];
      skipped: string[];
    };
    expect(res.created).toHaveLength(50);
    expect(res.created[0]?.code).toBe('C-001');
    expect(res.skipped).toEqual([]);
    const trees = (await call('listTrees', {
      tenantId: T,
      farmId: F,
    })) as Tree[];
    expect(trees.map(t => t.code).slice(0, 3)).toEqual([
      'C-001',
      'C-002',
      'C-003',
    ]);
    expect(new Set(trees.map(t => t.id)).size).toBe(50);
  });

  it('reports existing codes as skipped instead of creating duplicates', async () => {
    await call('bulkCreateTrees', {
      tenantId: T,
      farmId: F,
      start: 1,
      count: 10,
      status: 'PRODUCING',
    });
    const res = (await call('bulkCreateTrees', {
      tenantId: T,
      farmId: F,
      start: 8,
      count: 5,
      status: 'YOUNG',
    })) as {
      created: { code: string }[];
      skipped: string[];
    };
    expect(res.skipped).toEqual(['C-008', 'C-009', 'C-010']);
    expect(res.created.map(c => c.code)).toEqual(['C-011', 'C-012']);
  });

  it('writes one audit summary per run', async () => {
    await call('bulkCreateTrees', {
      tenantId: T,
      farmId: F,
      start: 1,
      count: 3,
      status: 'PRODUCING',
    });
    const audits = [...fake.store.values()].filter(
      i => i['action'] === 'tree.bulkCreate'
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.['details']).toMatchObject({
      count: 3,
      first: 'C-001',
      last: 'C-003',
    });
  });

  it('rejects too many trees', async () => {
    await expect(
      call('bulkCreateTrees', {
        tenantId: T,
        farmId: F,
        start: 1,
        count: 501,
        status: 'PRODUCING',
      })
    ).rejects.toThrow(/^VALIDATION/);
  });
});

describe('single trees (FR-CN-002..009)', () => {
  it('creates a missing tree, normalising its code', async () => {
    const tree = (await call('createTree', {
      tenantId: T,
      farmId: F,
      treeId: TREE,
      code: ' c 51 ',
      status: 'YOUNG',
    })) as Tree;
    expect(tree).toMatchObject({ code: 'C-51', status: 'YOUNG', version: 1 });
  });

  it('blocks a duplicate code in the same farm, even when archived (FR-CN-004/005)', async () => {
    await call('createTree', {
      tenantId: T,
      farmId: F,
      treeId: TREE,
      code: 'C-001',
      status: 'PRODUCING',
    });
    await call('updateTree', {
      tenantId: T,
      farmId: F,
      code: 'C-001',
      expectedVersion: 1,
      status: 'ARCHIVED',
    });
    await expect(
      call('createTree', {
        tenantId: T,
        farmId: F,
        treeId: TREE2,
        code: 'C-001',
        status: 'PRODUCING',
      })
    ).rejects.toThrow(/^CONFLICT: Tree code C-001 is already used/);
  });

  it('allows the same code on another tenant’s farm', async () => {
    await call('createTree', {
      tenantId: T,
      farmId: F,
      treeId: TREE,
      code: 'C-001',
      status: 'PRODUCING',
    });
    await expect(
      call(
        'createTree',
        {
          tenantId: T2,
          farmId: F2,
          treeId: TREE2,
          code: 'C-001',
          status: 'PRODUCING',
        },
        'other'
      )
    ).resolves.toMatchObject({ code: 'C-001' });
  });

  it('changes status and moves the status index; hides inactive trees by default', async () => {
    await call('createTree', {
      tenantId: T,
      farmId: F,
      treeId: TREE,
      code: 'C-001',
      status: 'PRODUCING',
    });
    const updated = (await call('updateTree', {
      tenantId: T,
      farmId: F,
      code: 'C-001',
      expectedVersion: 1,
      status: 'DEAD',
      notes: 'Lightning strike',
    })) as Tree;
    expect(updated).toMatchObject({ status: 'DEAD', version: 2 });
    const raw = [...fake.store.values()].find(i => i['id'] === TREE);
    expect(raw?.['GSI1PK']).toBe(`T#${T}#F#${F}#TS#DEAD`);
    expect(await call('listTrees', { tenantId: T, farmId: F })).toEqual([]);
    expect(
      await call('listTrees', { tenantId: T, farmId: F, includeInactive: true })
    ).toHaveLength(1);
  });

  it('gets a tree by id only within the caller’s tenant', async () => {
    await call('createTree', {
      tenantId: T,
      farmId: F,
      treeId: TREE,
      code: 'C-001',
      status: 'PRODUCING',
    });
    await expect(
      call('getTree', { tenantId: T, treeId: TREE })
    ).resolves.toMatchObject({ code: 'C-001' });
    await expect(
      call('getTree', { tenantId: T2, treeId: TREE }, 'other')
    ).rejects.toThrow(/^NOT_FOUND/);
  });

  it('a farm helper can view but not register trees', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#helper',
      tenantId: T,
      userId: 'helper',
      profileId: SYSTEM_PROFILE_IDS.farmHelper,
      status: 'ACTIVE',
    });
    await expect(
      call('listTrees', { tenantId: T, farmId: F }, 'helper')
    ).resolves.toEqual([]);
    await expect(
      call(
        'bulkCreateTrees',
        { tenantId: T, farmId: F, start: 1, count: 2, status: 'PRODUCING' },
        'helper'
      )
    ).rejects.toThrow(/^FORBIDDEN/);
  });
});
