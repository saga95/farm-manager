/**
 * Owns the app-wide photo upload queue (#48). Uploads keep going while the
 * user moves between screens, resume after a reload, and retry when the
 * device comes back online.
 */

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { completeMediaUpload, initiateMediaUpload } from '@/lib/api';
import { makeThumbnail } from './thumbnail';
import {
  type QueuedUpload,
  UploadQueue,
  defaultStore,
  postToPresigned,
} from './uploadQueue';

const QueueContext = createContext<UploadQueue | null>(null);

export const mediaKey = (tenantId: string, entityId: string) => [
  'media',
  tenantId,
  entityId,
];

export function MediaUploadProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<UploadQueue | null>(null);

  useEffect(() => {
    const q = new UploadQueue(
      defaultStore(),
      {
        initiate: e =>
          initiateMediaUpload(e.tenantId, {
            mediaId: e.mediaId,
            entityId: e.entityId,
            category: e.category ?? null,
            contentType: e.contentType,
            byteSize: e.file.size,
            capturedAt: e.capturedAt,
            caption: e.caption ?? null,
          }),
        post: postToPresigned,
        complete: e => completeMediaUpload(e.tenantId, e.entityId, e.mediaId),
        makeThumbnail,
      },
      media =>
        void qc.invalidateQueries({
          queryKey: ['media'],
          predicate: query => query.queryKey[2] === media.entityId,
        })
    );
    setQueue(q);
    void q.run();
    const online = () => {
      q.snapshot()
        .filter(e => e.state === 'FAILED')
        .forEach(e => void q.retry(e.mediaId));
    };
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      q.dispose();
    };
  }, [qc]);

  return (
    <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>
  );
}

export function useUploadQueue(): UploadQueue | null {
  return useContext(QueueContext);
}

/** Queue entries (pending / uploading / failed) for one entity. */
export function useEntityUploads(
  entityId: string | undefined
): readonly QueuedUpload[] {
  const queue = useUploadQueue();
  const [entries, setEntries] = useState<readonly QueuedUpload[]>(
    () => queue?.snapshot() ?? []
  );
  useEffect(() => {
    if (!queue) return undefined;
    setEntries(queue.snapshot());
    return queue.subscribe(setEntries);
  }, [queue]);
  return useMemo(
    () => entries.filter(e => e.entityId === entityId),
    [entries, entityId]
  );
}
