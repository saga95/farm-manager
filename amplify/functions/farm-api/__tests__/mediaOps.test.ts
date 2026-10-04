/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

const objects = new Map<string, number>();
jest.mock('../lib/objectStore', () => ({
  presignUpload: jest.fn(
    async (_t: string, key: string, contentType: unknown) => ({
      url: 'https://bucket.example/upload',
      fields: { key, 'Content-Type': contentType },
    })
  ),
  presignView: jest.fn(
    async (_t: string, key: string) => `https://bucket.example/${key}?sig`
  ),
  objectSize: jest.fn(
    async (_t: string, key: string) => objects.get(key) ?? null
  ),
}));

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

interface Upload {
  media: {
    id: string;
    status: string;
    version: number;
    thumbUrl?: string | null;
  };
  upload: string | null;
}
let treeId = '';

const initiate = (
  mediaId: string,
  extra: Record<string, unknown> = {},
  sub = 'owner'
) =>
  call(
    'initiateMediaUpload',
    {
      tenantId: T,
      mediaId,
      entityId: treeId,
      contentType: 'image/jpeg',
      byteSize: 2_000_000,
      capturedAt: '2026-09-01T07:30:00+05:30',
      ...extra,
    },
    sub
  ) as Promise<Upload>;

/** Simulate the browser POSTing both files to the presigned URLs. */
function uploadFiles(u: Upload) {
  const parsed = JSON.parse(u.upload!) as Record<
    'original' | 'thumb',
    { fields: { key: string } }
  >;
  objects.set(parsed.original.fields.key, 2_000_000);
  objects.set(parsed.thumb.fields.key, 40_000);
  return parsed;
}

beforeEach(async () => {
  fake.reset();
  objects.clear();
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
  const created = (await call('bulkCreateTrees', {
    tenantId: T,
    farmId: F,
    start: 1,
    count: 1,
    status: 'PRODUCING',
  })) as { created: { id: string }[] };
  treeId = created.created[0]!.id;
});

describe('media upload (#46, ADR-0003)', () => {
  it('initiate → upload → complete → listed with a thumbnail URL only', async () => {
    const mediaId = ulid();
    const u = await initiate(mediaId);
    expect(u.media).toMatchObject({
      status: 'PENDING',
      category: 'TREE_PROFILE',
    });
    const parsed = uploadFiles(u);
    expect(parsed.original.fields.key).toMatch(
      new RegExp(
        `^tenants/${T}/farms/${F}/TREE_PROFILE/TREE/${treeId}/${mediaId}/original\\.jpg$`
      )
    );

    const done = (await call('completeMediaUpload', {
      tenantId: T,
      entityId: treeId,
      mediaId,
    })) as {
      status: string;
      thumbUrl: string;
      capturedAt: string;
    };
    expect(done.status).toBe('READY');
    expect(done.thumbUrl).toContain('/thumb?sig');
    expect(done.capturedAt).toBe('2026-09-01T07:30:00+05:30');

    const list = (await call('listMedia', {
      tenantId: T,
      entityId: treeId,
    })) as { thumbUrl: string }[];
    expect(list).toHaveLength(1);
    expect(list[0]!.thumbUrl).toContain('/thumb?sig');
    expect(JSON.stringify(list)).not.toContain('original.jpg');
  });

  it('a retry with the same mediaId re-signs the same keys; no duplicate (#48)', async () => {
    const mediaId = ulid();
    const a = await initiate(mediaId);
    const b = await initiate(mediaId);
    expect(JSON.parse(b.upload!)).toEqual(JSON.parse(a.upload!));
    expect(
      [...fake.store.values()].filter(i => i['entityType'] === 'Media')
    ).toHaveLength(1);
    uploadFiles(b);
    await call('completeMediaUpload', {
      tenantId: T,
      entityId: treeId,
      mediaId,
    });
    const again = await initiate(mediaId);
    expect(again.upload).toBeNull();
    expect(again.media.status).toBe('READY');
  });

  it('complete fails clearly until the files have arrived; the photo stays pending', async () => {
    const mediaId = ulid();
    await initiate(mediaId);
    await expect(
      call('completeMediaUpload', { tenantId: T, entityId: treeId, mediaId })
    ).rejects.toThrow(/^VALIDATION: upload/);
    const list = (await call('listMedia', {
      tenantId: T,
      entityId: treeId,
    })) as {
      status: string;
      thumbUrl: string | null;
    }[];
    expect(list).toEqual([
      expect.objectContaining({ status: 'PENDING', thumbUrl: null }),
    ]);
  });

  it('original URL on request; archived photos disappear from the list', async () => {
    const mediaId = ulid();
    uploadFiles(await initiate(mediaId));
    const m = (await call('completeMediaUpload', {
      tenantId: T,
      entityId: treeId,
      mediaId,
    })) as {
      version: number;
    };
    const url = (await call('getMediaOriginalUrl', {
      tenantId: T,
      mediaId,
    })) as string;
    expect(url).toContain('original.jpg');
    await call('archiveMedia', {
      tenantId: T,
      entityId: treeId,
      mediaId,
      expectedVersion: m.version,
    });
    expect(await call('listMedia', { tenantId: T, entityId: treeId })).toEqual(
      []
    );
  });
});

describe('media validation and access (AC-TN-004)', () => {
  it('rejects non-image types and oversize files', async () => {
    await expect(
      initiate(ulid(), { contentType: 'application/pdf' })
    ).rejects.toThrow(/^VALIDATION/);
    await expect(
      initiate(ulid(), { byteSize: 16 * 1024 * 1024 })
    ).rejects.toThrow(/^VALIDATION/);
  });

  it('another tenant cannot attach to, list or open this tenant’s photos', async () => {
    const mediaId = ulid();
    uploadFiles(await initiate(mediaId));
    await call('completeMediaUpload', {
      tenantId: T,
      entityId: treeId,
      mediaId,
    });
    const asOther = { tenantId: T2 };
    await expect(
      call(
        'initiateMediaUpload',
        {
          ...asOther,
          mediaId: ulid(),
          entityId: treeId,
          contentType: 'image/jpeg',
          byteSize: 10,
        },
        'other'
      )
    ).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      call('listMedia', { ...asOther, entityId: treeId }, 'other')
    ).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      call('getMediaOriginalUrl', { ...asOther, mediaId }, 'other')
    ).rejects.toThrow(/^NOT_FOUND/);
    await expect(
      call('listMedia', { tenantId: T, entityId: treeId }, 'other')
    ).rejects.toThrow(/^FORBIDDEN/);
  });

  it('a farm helper can upload; a viewer can look but not upload', async () => {
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
    await expect(initiate(ulid(), {}, 'helper')).resolves.toMatchObject({
      media: { status: 'PENDING' },
    });
    await expect(initiate(ulid(), {}, 'viewer')).rejects.toThrow(/^FORBIDDEN/);
    await expect(
      call('listMedia', { tenantId: T, entityId: treeId }, 'viewer')
    ).resolves.toHaveLength(1);
  });
});
