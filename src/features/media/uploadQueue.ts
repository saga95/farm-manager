/**
 * Durable photo upload queue (SRS §41.12, ADR-0003 §5, #48).
 *
 * The record a photo belongs to is already saved; photos upload in the
 * background and never block it. Each entry keeps its client mediaId, so a
 * retry (after a crash, reload or lost signal) re-signs the same keys on the
 * server and never creates a duplicate. Failures stay visible until retried or
 * removed. Entries live in IndexedDB so they survive reloads.
 */

import type { Media, MediaUploadTarget, PresignedPost } from '@/lib/api';

export type UploadState = 'QUEUED' | 'UPLOADING' | 'FAILED';

export interface QueuedUpload {
  mediaId: string;
  tenantId: string;
  entityId: string;
  category?: string | null;
  caption?: string | null;
  file: Blob;
  contentType: string;
  capturedAt: string | null;
  thumb?: Blob | null;
  state: UploadState;
  attempts: number;
  error?: string | null;
  createdAt: string;
}

export interface QueueStore {
  all(): Promise<QueuedUpload[]>;
  put(entry: QueuedUpload): Promise<void>;
  remove(mediaId: string): Promise<void>;
}

export interface UploadDeps {
  initiate(entry: QueuedUpload): Promise<MediaUploadTarget>;
  post(target: PresignedPost, blob: Blob, contentType: string): Promise<void>;
  complete(entry: QueuedUpload): Promise<Media>;
  makeThumbnail(file: Blob): Promise<Blob>;
}

/** Automatic retries before an entry waits for a manual retry. */
export const MAX_AUTO_ATTEMPTS = 3;
const BACKOFF_MS = [2_000, 8_000, 30_000];

export function memoryStore(): QueueStore {
  const map = new Map<string, QueuedUpload>();
  return {
    all: async () => [...map.values()],
    put: async e => {
      map.set(e.mediaId, e);
    },
    remove: async id => {
      map.delete(id);
    },
  };
}

const DB_NAME = 'farm-media';
const STORE = 'uploads';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'mediaId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function indexedDbStore(): QueueStore {
  return {
    all: () =>
      tx<QueuedUpload[]>(
        'readonly',
        s => s.getAll() as IDBRequest<QueuedUpload[]>
      ),
    put: e => tx('readwrite', s => s.put(e)).then(() => undefined),
    remove: id => tx('readwrite', s => s.delete(id)).then(() => undefined),
  };
}

/** IndexedDB in the browser; memory elsewhere (SSR, tests, private modes without IDB). */
export function defaultStore(): QueueStore {
  return typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore();
}

/** POST a file to a presigned S3 form (fields first, file last). */
export async function postToPresigned(
  target: PresignedPost,
  blob: Blob,
  contentType: string
): Promise<void> {
  const form = new FormData();
  Object.entries(target.fields).forEach(([k, v]) => form.append(k, v));
  if (!target.fields['Content-Type']) form.append('Content-Type', contentType);
  form.append('file', blob);
  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

type Listener = (entries: readonly QueuedUpload[]) => void;

export class UploadQueue {
  private entries: QueuedUpload[] = [];
  private listeners = new Set<Listener>();
  private active: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private loaded: Promise<void>;

  constructor(
    private readonly store: QueueStore,
    private readonly deps: UploadDeps,
    private readonly onUploaded: (media: Media) => void = () => undefined
  ) {
    this.loaded = store
      .all()
      .then(saved => {
        // An upload interrupted mid-flight is simply queued again.
        this.entries = saved.map(e =>
          e.state === 'UPLOADING' ? { ...e, state: 'QUEUED' } : e
        );
        this.emit();
      })
      .catch(() => undefined);
  }

  snapshot(): readonly QueuedUpload[] {
    return this.entries;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async enqueue(
    input: Omit<
      QueuedUpload,
      'state' | 'attempts' | 'createdAt' | 'error' | 'thumb'
    >
  ): Promise<void> {
    await this.loaded;
    const entry: QueuedUpload = {
      ...input,
      state: 'QUEUED',
      attempts: 0,
      error: null,
      createdAt: new Date().toISOString(),
    };
    await this.save(entry);
    void this.run();
  }

  /** Manual retry: resets the automatic attempt budget. */
  async retry(mediaId: string): Promise<void> {
    const e = this.entries.find(x => x.mediaId === mediaId);
    if (!e) return;
    await this.save({ ...e, state: 'QUEUED', attempts: 0, error: null });
    void this.run();
  }

  async remove(mediaId: string): Promise<void> {
    this.entries = this.entries.filter(e => e.mediaId !== mediaId);
    this.emit();
    await this.store.remove(mediaId);
  }

  /**
   * Process every queued entry, one at a time. Safe to call repeatedly: a
   * call while a run is in flight returns that run (which also picks up
   * entries queued meanwhile).
   */
  run(): Promise<void> {
    if (!this.active) {
      this.active = this.drain().finally(() => {
        this.active = null;
        this.scheduleAutoRetry();
      });
    }
    return this.active;
  }

  private async drain(): Promise<void> {
    await this.loaded;
    for (;;) {
      const next = this.entries.find(e => e.state === 'QUEUED');
      if (!next) break;
      await this.process(next);
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
  }

  private async process(entry: QueuedUpload): Promise<void> {
    let current: QueuedUpload = {
      ...entry,
      state: 'UPLOADING',
      attempts: entry.attempts + 1,
    };
    await this.save(current);
    try {
      if (!current.thumb) {
        current = {
          ...current,
          thumb: await this.deps.makeThumbnail(current.file),
        };
        await this.save(current);
      }
      const target = await this.deps.initiate(current);
      if (target.upload) {
        await this.deps.post(
          target.upload.original,
          current.file,
          current.contentType
        );
        const thumb = current.thumb as Blob;
        await this.deps.post(
          target.upload.thumb,
          thumb,
          thumb.type || 'image/jpeg'
        );
      }
      const media = target.upload
        ? await this.deps.complete(current)
        : target.media;
      await this.remove(current.mediaId);
      this.onUploaded(media);
    } catch (e) {
      await this.save({
        ...current,
        state: 'FAILED',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private scheduleAutoRetry(): void {
    if (this.timer) clearTimeout(this.timer);
    const retryable = this.entries.filter(
      e => e.state === 'FAILED' && e.attempts < MAX_AUTO_ATTEMPTS
    );
    if (retryable.length === 0) return;
    const wait = Math.min(
      ...retryable.map(e => BACKOFF_MS[e.attempts - 1] ?? BACKOFF_MS.at(-1)!)
    );
    this.timer = setTimeout(() => {
      this.timer = null;
      void Promise.all(
        retryable.map(e => {
          const latest = this.entries.find(x => x.mediaId === e.mediaId);
          return latest && latest.state === 'FAILED'
            ? this.save({ ...latest, state: 'QUEUED' })
            : undefined;
        })
      ).then(() => this.run());
    }, wait);
  }

  private async save(entry: QueuedUpload): Promise<void> {
    const i = this.entries.findIndex(e => e.mediaId === entry.mediaId);
    this.entries =
      i === -1
        ? [...this.entries, entry]
        : this.entries.map(e => (e.mediaId === entry.mediaId ? entry : e));
    this.emit();
    try {
      await this.store.put(entry);
    } catch {
      // Storage full or unavailable: the in-memory entry still uploads.
    }
  }

  private emit(): void {
    this.listeners.forEach(l => l(this.entries));
  }
}
