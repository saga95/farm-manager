/**
 * EntityPhotos: PhotoStrip + PhotoViewer wired to the API and upload queue.
 * Drop it on any record page: <EntityPhotos entityId={tree.id} name={tree.code} />
 */

import { useState } from 'react';
import { useTenant } from '@/features/tenant';
import {
  useAddPhotos,
  useArchiveMedia,
  useMediaList,
  useOriginalUrl,
} from '../hooks';
import { useEntityUploads, useUploadQueue } from '../MediaUploadProvider';
import { PhotoStrip } from './PhotoStrip';
import { PhotoViewer } from './PhotoViewer';

export interface EntityPhotosProps {
  entityId: string;
  name: string;
  category?: string;
}

export function EntityPhotos({ entityId, name, category }: EntityPhotosProps) {
  const { can } = useTenant();
  const list = useMediaList(entityId);
  const queue = useUploadQueue();
  const queued = useEntityUploads(entityId);
  const add = useAddPhotos(entityId, category);
  const archive = useArchiveMedia(entityId);
  const [index, setIndex] = useState<number | null>(null);

  const photos = list.data ?? [];
  const ready = photos.filter(p => p.status === 'READY');
  const current = index === null ? null : (ready[index] ?? null);
  const original = useOriginalUrl(current);

  return (
    <>
      <PhotoStrip
        name={name}
        photos={photos}
        queued={queued}
        loading={list.isLoading}
        canUpload={can('media.upload') && Boolean(queue)}
        onAdd={add}
        onOpen={setIndex}
        onRetry={id => void queue?.retry(id)}
        onRemoveQueued={id => void queue?.remove(id)}
      />
      <PhotoViewer
        photos={ready}
        index={index}
        onIndexChange={setIndex}
        originalUrl={original.data}
        originalLoading={original.isFetching}
        originalFailed={original.isError}
        onArchive={
          can('record.archive')
            ? media =>
                void archive.mutateAsync(media).then(() => {
                  setIndex(null);
                })
            : undefined
        }
        archiving={archive.isLoading}
      />
    </>
  );
}

export default EntityPhotos;
