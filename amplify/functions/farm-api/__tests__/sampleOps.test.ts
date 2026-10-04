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

let trees: { id: string; code: string }[] = [];
const tree = (code: string) => trees.find(t => t.code === code)!.id;

async function harvestOn(date: string, code: string, quantity: number) {
  const roundId = ulid();
  await call('createPluckingRound', {
    tenantId: T,
    farmId: F,
    roundId,
    roundDate: date,
    plannedTreeIds: [tree(code)],
  });
  return (await call('recordTreeHarvest', {
    tenantId: T,
    roundId,
    treeId: tree(code),
    harvestId: ulid(),
    quantity,
  })) as {
    id: string;
    roundId: string;
  };
}

const sample = (
  harvestId: string,
  sizeClass: string,
  extra = {},
  sub = 'owner'
) =>
  call(
    'recordCoconutSample',
    { tenantId: T, harvestId, sampleId: ulid(), sizeClass, ...extra },
    sub
  );

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
  trees = (
    (await call('bulkCreateTrees', {
      tenantId: T,
      farmId: F,
      start: 1,
      count: 3,
      status: 'PRODUCING',
    })) as {
      created: { id: string; code: string }[];
    }
  ).created;
});

describe('recordCoconutSample (§9, AC-SM-001/002)', () => {
  it('records one Medium sample for a harvest; tree shows latest sample Medium', async () => {
    const h = await harvestOn('2026-10-04', 'C-001', 20);
    const s = (await sample(h.id, 'MEDIUM')) as {
      sizeClass: string;
      sampledAt: string;
      treeCode: string;
    };
    expect(s).toMatchObject({
      sizeClass: 'MEDIUM',
      sampledAt: '2026-10-04',
      treeCode: 'C-001',
    });
    const raw = [...fake.store.values()].find(i => i['id'] === tree('C-001'))!;
    expect(raw).toMatchObject({ latestSampleSize: 'MEDIUM', sampleCount: 1 });
  });

  it('one sample per harvest: a second call corrects it (audited), not a second sample', async () => {
    const h = await harvestOn('2026-10-04', 'C-001', 20);
    await sample(h.id, 'MEDIUM');
    const corrected = (await sample(h.id, 'LARGE', { weight: 950 })) as {
      sizeClass: string;
      version: number;
      weightUnit: string;
    };
    expect(corrected).toMatchObject({
      sizeClass: 'LARGE',
      version: 2,
      weightUnit: 'G',
    });
    expect(
      [...fake.store.values()].filter(i => i['entityType'] === 'CoconutSample')
    ).toHaveLength(1);
    const actions = [...fake.store.values()]
      .filter(i => i['entityType'] === 'AuditLog')
      .map(i => i['action']);
    expect(actions).toEqual(
      expect.arrayContaining(['sample.record', 'sample.correct'])
    );
  });

  it('AC-SM-004: a sample never creates or changes produce inventory', async () => {
    const h = await harvestOn('2026-10-04', 'C-001', 20);
    await call('completePluckingRound', {
      tenantId: T,
      roundId: h.roundId,
      expectedVersion: 1,
    });
    const before = [...fake.store.values()]
      .filter(i => i['entityType'] === 'ProduceBatch')
      .map(i => structuredClone(i));
    await sample(h.id, 'MEDIUM');
    const after = [...fake.store.values()].filter(
      i => i['entityType'] === 'ProduceBatch'
    );
    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({
      availableByState: { HUSKED: 20, DEHUSKED: 0 },
    });
  });

  it('UNCLASSIFIED is a sample without a size; no harvest → no sample is ever auto-created', async () => {
    const h = await harvestOn('2026-10-04', 'C-002', 15);
    expect(
      [...fake.store.values()].filter(i => i['entityType'] === 'CoconutSample')
    ).toHaveLength(0);
    await sample(h.id, 'UNCLASSIFIED');
    const hist = (await call('getTreeHistory', {
      tenantId: T,
      treeId: tree('C-002'),
    })) as {
      sizeHistory: {
        latest: string;
        sampleCount: number;
        tendency: string | null;
      };
    };
    expect(hist.sizeHistory).toMatchObject({
      latest: 'UNCLASSIFIED',
      sampleCount: 1,
      tendency: null,
    });
  });
});

describe('size history through the API (AC-SM-003)', () => {
  it('L, L, M, L, L → four Large, one Medium; tendency Large', async () => {
    const sizes = ['LARGE', 'LARGE', 'MEDIUM', 'LARGE', 'LARGE'];
    const dates = [
      '2026-01-10',
      '2026-03-10',
      '2026-05-10',
      '2026-07-10',
      '2026-09-10',
    ];
    for (let i = 0; i < sizes.length; i += 1) {
      const h = await harvestOn(dates[i]!, 'C-003', 20);
      await sample(h.id, sizes[i]!);
    }
    const hist = (await call('getTreeHistory', {
      tenantId: T,
      treeId: tree('C-003'),
    })) as {
      samples: { sizeClass: string }[];
      sizeHistory: {
        counts: Record<string, number>;
        tendency: string;
        tendencyMatches: number;
        latest: string;
      };
    };
    expect(hist.sizeHistory.counts).toEqual({
      SMALL: 0,
      MEDIUM: 1,
      LARGE: 4,
      UNCLASSIFIED: 0,
    });
    expect(hist.sizeHistory).toMatchObject({
      tendency: 'LARGE',
      tendencyMatches: 4,
      latest: 'LARGE',
    });
    expect(hist.samples).toHaveLength(5);
    const raw = [...fake.store.values()].find(i => i['id'] === tree('C-003'))!;
    expect(raw).toMatchObject({
      sizeTendency: 'LARGE',
      latestSampleSize: 'LARGE',
      sampleCount: 5,
    });
  });

  it('round detail includes the samples for its harvests', async () => {
    const h = await harvestOn('2026-10-04', 'C-001', 20);
    await sample(h.id, 'SMALL');
    const d = (await call('getPluckingRound', {
      tenantId: T,
      roundId: h.roundId,
    })) as {
      samples: { harvestId: string; sizeClass: string }[];
    };
    expect(d.samples).toEqual([
      expect.objectContaining({ harvestId: h.id, sizeClass: 'SMALL' }),
    ]);
  });
});

describe('validation and access', () => {
  it('rejects unknown sizes and other tenants’ harvests', async () => {
    const h = await harvestOn('2026-10-04', 'C-001', 20);
    await expect(sample(h.id, 'EXTRA_LARGE')).rejects.toThrow(
      /^VALIDATION: sizeClass/
    );
    await expect(
      call(
        'recordCoconutSample',
        { tenantId: T2, harvestId: h.id, sampleId: ulid(), sizeClass: 'SMALL' },
        'other'
      )
    ).rejects.toThrow(/^NOT_FOUND/);
  });

  it('a farm helper can record samples; a viewer cannot', async () => {
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
    const h = await harvestOn('2026-10-04', 'C-001', 20);
    await expect(sample(h.id, 'MEDIUM', {}, 'helper')).resolves.toMatchObject({
      sizeClass: 'MEDIUM',
    });
    await expect(sample(h.id, 'LARGE', {}, 'viewer')).rejects.toThrow(
      /^FORBIDDEN/
    );
  });
});
