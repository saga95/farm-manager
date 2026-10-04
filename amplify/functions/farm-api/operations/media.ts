/**
 * Media (#46–#48, SRS §15, §41.12, ADR-0003).
 *
 * initiate → client POSTs original + thumbnail to presigned URLs → complete.
 * Clients never get bucket credentials. The structured record never waits for
 * media: photos attach to an existing entity, and a retry with the same client
 * mediaId re-signs the same keys instead of creating a duplicate (ADR-0004).
 */

import { z } from 'zod';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  DEFAULT_CATEGORY,
  MAX_MEDIA_BYTES,
  MAX_THUMB_BYTES,
  MEDIA_CATEGORIES,
  MEDIA_CONTENT_TYPES,
  MEDIA_ENTITY_TYPES,
  type MediaContentType,
  type MediaEntityType,
  mediaObjectKeys,
} from '../../../../src/domain/media';
import {
  type Item,
  createWithAudit,
  getById,
  getItem,
  queryPrefix,
  toView,
  updateWithAudit,
} from '../lib/crud';
import { ApiError, notFound } from '../lib/errors';
import { objectSize, presignUpload, presignView } from '../lib/objectStore';
import { type TenantContext, tenantOperation } from '../lib/operation';

const id = z.string().refine(isUlid, 'must be a ULID');
const contentTypes = Object.keys(MEDIA_CONTENT_TYPES) as [
  MediaContentType,
  ...MediaContentType[],
];

/** The entity a photo attaches to; must be in the caller's tenant and live. */
async function mediaTarget(entityId: string, ctx: TenantContext) {
  const entity = await getById(entityId, ctx);
  const type =
    entity &&
    (MEDIA_ENTITY_TYPES as Record<string, MediaEntityType>)[
      String(entity['entityType'])
    ];
  if (!entity || !type || entity['deletedAt'] || !entity['farmId'])
    throw notFound('Record not found');
  return { entity, entityType: type, farmId: String(entity['farmId']) };
}

/** Client view: never exposes storage keys; URLs are short-lived presigned ones. */
function mediaView(item: Item): Item {
  const {
    objectKey: _objectKey,
    thumbnailKey: _thumbnailKey,
    ...rest
  } = toView<Item>(item);
  return rest;
}

async function withThumbUrl(ctx: TenantContext, item: Item) {
  const thumb =
    item['status'] === 'READY' && item['thumbnailKey']
      ? await presignView(ctx.access.tenantId, String(item['thumbnailKey']))
      : null;
  return { ...mediaView(item), thumbUrl: thumb };
}

async function signUploads(ctx: TenantContext, item: Item) {
  const { tenantId } = ctx.access;
  const [original, thumb] = await Promise.all([
    presignUpload(
      tenantId,
      String(item['objectKey']),
      String(item['contentType']),
      MAX_MEDIA_BYTES
    ),
    presignUpload(
      tenantId,
      String(item['thumbnailKey']),
      { startsWith: 'image/' },
      MAX_THUMB_BYTES
    ),
  ]);
  return JSON.stringify({ original, thumb });
}

export const initiateMediaUpload = tenantOperation({
  name: 'initiateMediaUpload',
  entitlement: 'media.upload',
  input: z.object({
    tenantId: z.string().min(1),
    mediaId: id,
    entityId: id,
    category: z.enum(MEDIA_CATEGORIES).nullish(),
    contentType: z.enum(contentTypes),
    byteSize: z.number().int().positive().max(MAX_MEDIA_BYTES),
    capturedAt: z.string().datetime({ offset: true }).nullish(),
    caption: z.string().trim().max(500).nullish(),
  }),
  handler: async (input, ctx) => {
    const { entity, entityType, farmId } = await mediaTarget(
      input.entityId,
      ctx
    );
    const key = keys.media(ctx.access.tenantId, input.entityId, input.mediaId);
    const existing = await getItem(key);
    if (existing) {
      // Retry of the same upload (ADR-0004): re-sign the same keys.
      if (existing['status'] === 'READY')
        return { media: await withThumbUrl(ctx, existing), upload: null };
      return {
        media: mediaView(existing),
        upload: await signUploads(ctx, existing),
      };
    }

    const category = input.category ?? DEFAULT_CATEGORY[entityType];
    const objectKeys = mediaObjectKeys({
      tenantId: ctx.access.tenantId,
      farmId,
      category,
      entityType,
      entityId: input.entityId,
      mediaId: input.mediaId,
      contentType: input.contentType,
    });
    const item = await createWithAudit({
      ctx,
      key,
      id: input.mediaId,
      entityType: 'Media',
      attributes: {
        farmId,
        entityId: input.entityId,
        targetType: entityType,
        entityLabel: entity['code'] ?? entity['treeCode'] ?? null,
        category,
        contentType: input.contentType,
        byteSize: input.byteSize,
        capturedAt: input.capturedAt ?? null,
        caption: input.caption ?? null,
        status: 'PENDING',
        objectKey: objectKeys.original,
        thumbnailKey: objectKeys.thumb,
      },
      action: 'media.initiate',
    });
    return { media: mediaView(item), upload: await signUploads(ctx, item) };
  },
});

export const completeMediaUpload = tenantOperation({
  name: 'completeMediaUpload',
  entitlement: 'media.upload',
  input: z.object({
    tenantId: z.string().min(1),
    entityId: id,
    mediaId: id,
  }),
  handler: async (input, ctx) => {
    const key = keys.media(ctx.access.tenantId, input.entityId, input.mediaId);
    const item = await getItem(key);
    if (!item || item['deletedAt']) throw notFound('Photo not found');
    if (item['status'] === 'READY') return withThumbUrl(ctx, item);

    const { tenantId } = ctx.access;
    const [original, thumb] = await Promise.all([
      objectSize(tenantId, String(item['objectKey'])),
      objectSize(tenantId, String(item['thumbnailKey'])),
    ]);
    if (original === null || thumb === null)
      throw new ApiError('VALIDATION', 'upload: file not received yet');

    const next = await updateWithAudit({
      ctx,
      key,
      expectedVersion: Number(item['version']),
      changes: { status: 'READY', byteSize: original, thumbnailBytes: thumb },
      action: 'media.complete',
    });
    return withThumbUrl(ctx, next);
  },
});

export const listMedia = tenantOperation({
  name: 'listMedia',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), entityId: id }),
  handler: async (input, ctx) => {
    await mediaTarget(input.entityId, ctx);
    const items = await queryPrefix(
      keys.mediaPk(ctx.access.tenantId, input.entityId),
      keys.prefix.media
    );
    // Lists use thumbnails only (ADR-0003); newest first.
    return Promise.all(
      items
        .filter(i => !i['deletedAt'])
        .reverse()
        .map(i => withThumbUrl(ctx, i))
    );
  },
});

export const getMediaOriginalUrl = tenantOperation({
  name: 'getMediaOriginalUrl',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), mediaId: id }),
  handler: async (input, ctx) => {
    const item = await getById(input.mediaId, ctx);
    if (!item || item['entityType'] !== 'Media' || item['deletedAt'])
      throw notFound('Photo not found');
    if (item['status'] !== 'READY')
      throw new ApiError('VALIDATION', 'upload: not finished');
    return presignView(ctx.access.tenantId, String(item['objectKey']));
  },
});

export const archiveMedia = tenantOperation({
  name: 'archiveMedia',
  entitlement: 'record.archive',
  input: z.object({
    tenantId: z.string().min(1),
    entityId: id,
    mediaId: id,
    expectedVersion: z.number().int().positive(),
  }),
  handler: async (input, ctx) => {
    const key = keys.media(ctx.access.tenantId, input.entityId, input.mediaId);
    const item = await updateWithAudit({
      ctx,
      key,
      expectedVersion: input.expectedVersion,
      changes: { deletedAt: ctx.now, deletedBy: ctx.userId },
      action: 'media.archive',
    });
    return mediaView(item);
  },
});
