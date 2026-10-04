import type { Media, MediaUploadTarget } from '@/lib/api';
import {
  MAX_AUTO_ATTEMPTS,
  type QueuedUpload,
  type UploadDeps,
  UploadQueue,
  memoryStore,
} from '../uploadQueue';

const media = (id: string): Media => ({
  id,
  entityId: 'E1',
  targetType: 'TREE',
  category: 'TREE_PROFILE',
  contentType: 'image/jpeg',
  status: 'READY',
  version: 2,
});
const target = (id: string, uploaded = false): MediaUploadTarget => ({
  media: { ...media(id), status: uploaded ? 'READY' : 'PENDING', version: 1 },
  upload: uploaded
    ? null
    : {
        original: { url: 'u', fields: { key: 'o' } },
        thumb: { url: 'u', fields: { key: 't' } },
      },
});

function setup(overrides: Partial<UploadDeps> = {}) {
  const deps: jest.Mocked<UploadDeps> = {
    initiate: jest.fn(async (e: QueuedUpload) => target(e.mediaId)),
    post: jest.fn(async () => undefined),
    complete: jest.fn(async (e: QueuedUpload) => media(e.mediaId)),
    makeThumbnail: jest.fn(async () => new Blob(['t'], { type: 'image/webp' })),
    ...overrides,
  } as jest.Mocked<UploadDeps>;
  const uploaded: Media[] = [];
  const store = memoryStore();
  const queue = new UploadQueue(store, deps, m => uploaded.push(m));
  return { deps, queue, uploaded, store };
}

const input = (mediaId: string) => ({
  mediaId,
  tenantId: 'T1',
  entityId: 'E1',
  file: new Blob(['x'], { type: 'image/jpeg' }),
  contentType: 'image/jpeg',
  capturedAt: null,
});

const settle = () => new Promise(r => setTimeout(r, 0));

describe('UploadQueue (#48)', () => {
  afterEach(() => jest.useRealTimers());

  it('uploads original + thumbnail, completes, and leaves the queue', async () => {
    const { deps, queue, uploaded, store } = setup();
    await queue.enqueue(input('M1'));
    await queue.run();
    expect(deps.post).toHaveBeenCalledTimes(2);
    expect(deps.post.mock.calls[1]![2]).toBe('image/webp');
    expect(deps.complete).toHaveBeenCalledTimes(1);
    expect(uploaded.map(m => m.id)).toEqual(['M1']);
    expect(queue.snapshot()).toEqual([]);
    expect(await store.all()).toEqual([]);
  });

  it('a failure stays visible; a manual retry reuses the same mediaId (no duplicate)', async () => {
    let fail = true;
    const { deps, queue } = setup({
      post: jest.fn(async () => {
        if (fail) throw new Error('Network down');
      }),
    });
    await queue.enqueue(input('M1'));
    await queue.run();
    expect(queue.snapshot()).toEqual([
      expect.objectContaining({
        mediaId: 'M1',
        state: 'FAILED',
        error: 'Network down',
        attempts: 1,
      }),
    ]);
    fail = false;
    await queue.retry('M1');
    await queue.run();
    expect(queue.snapshot()).toEqual([]);
    expect(deps.initiate.mock.calls.map(c => c[0].mediaId)).toEqual([
      'M1',
      'M1',
    ]);
    // The thumbnail is made once and kept across retries.
    expect(deps.makeThumbnail).toHaveBeenCalledTimes(1);
  });

  it('when the server says it is already uploaded, nothing is re-sent', async () => {
    const { deps, queue, uploaded } = setup({
      initiate: jest.fn(async (e: QueuedUpload) => target(e.mediaId, true)),
    });
    await queue.enqueue(input('M1'));
    await queue.run();
    expect(deps.post).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
    expect(uploaded).toHaveLength(1);
  });

  it('retries automatically with backoff, then waits for a manual retry', async () => {
    jest.useFakeTimers();
    const { deps, queue } = setup({
      initiate: jest.fn(async () => Promise.reject(new Error('offline'))),
    });
    await queue.enqueue(input('M1'));
    for (let i = 0; i < MAX_AUTO_ATTEMPTS + 1; i += 1) {
      await jest.advanceTimersByTimeAsync(60_000);
    }
    expect(deps.initiate).toHaveBeenCalledTimes(MAX_AUTO_ATTEMPTS);
    expect(queue.snapshot()[0]).toMatchObject({
      state: 'FAILED',
      attempts: MAX_AUTO_ATTEMPTS,
    });
  });

  it('entries interrupted mid-upload are queued again after a reload', async () => {
    const store = memoryStore();
    await store.put({
      ...input('M9'),
      state: 'UPLOADING',
      attempts: 1,
      createdAt: 'x',
    });
    const queue = new UploadQueue(store, setup().deps);
    await settle();
    expect(queue.snapshot()[0]).toMatchObject({
      mediaId: 'M9',
      state: 'QUEUED',
    });
    queue.dispose();
  });
});
