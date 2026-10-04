/** Photo hooks (React Query). Lists use thumbnails only (ADR-0003). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ulid } from 'ulid';
import {
  type Media,
  archiveMedia,
  getMediaOriginalUrl,
  listMedia,
} from '@/lib/api';
import { useTenant } from '@/features/tenant';
import { MAX_MEDIA_BYTES, isMediaContentType } from '@/domain/media';
import { capturedAtOf } from './exif';
import { mediaKey, useUploadQueue } from './MediaUploadProvider';

export function useMediaList(entityId: string | undefined) {
  const { tenant } = useTenant();
  const tenantId = tenant?.tenantId ?? '';
  return useQuery({
    queryKey: mediaKey(tenantId, entityId ?? ''),
    queryFn: () => listMedia(tenantId, entityId as string),
    enabled: Boolean(tenantId && entityId),
    // Presigned thumbnail URLs live 10 minutes; refresh well before that.
    staleTime: 5 * 60_000,
  });
}

export function useOriginalUrl(media: Media | null) {
  const { tenant } = useTenant();
  const tenantId = tenant?.tenantId ?? '';
  return useQuery({
    queryKey: ['mediaOriginal', tenantId, media?.id],
    queryFn: () => getMediaOriginalUrl(tenantId, (media as Media).id),
    enabled: Boolean(tenantId && media && media.status === 'READY'),
    staleTime: 5 * 60_000,
  });
}

export function useArchiveMedia(entityId: string) {
  const qc = useQueryClient();
  const { tenant } = useTenant();
  const tenantId = tenant?.tenantId ?? '';
  return useMutation({
    mutationFn: (media: Media) => archiveMedia(tenantId, media),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: mediaKey(tenantId, entityId) }),
  });
}

/** Queue photos for upload; returns how many files were rejected (not images, or too big). */
export function useAddPhotos(entityId: string | undefined, category?: string) {
  const queue = useUploadQueue();
  const { tenant } = useTenant();
  const tenantId = tenant?.tenantId ?? '';
  return async (files: readonly File[]): Promise<number> => {
    if (!queue || !tenantId || !entityId) return files.length;
    let rejected = 0;
    for (const file of files) {
      if (!isMediaContentType(file.type) || file.size > MAX_MEDIA_BYTES) {
        rejected += 1;
      } else {
        await queue.enqueue({
          mediaId: ulid(),
          tenantId,
          entityId,
          category: category ?? null,
          file,
          contentType: file.type,
          capturedAt: await capturedAtOf(file),
        });
      }
    }
    return rejected;
  };
}
