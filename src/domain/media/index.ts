/**
 * Media rules (SRS §15, §41.12, ADR-0003).
 *
 * Photos are private farm records. Object keys are tenant-prefixed and built
 * ONLY here, so a handler that builds keys from the authorized tenant can never
 * address another tenant's files. The client uploads a 480 px thumbnail (WebP,
 * or JPEG where the browser can't encode WebP) next to the original (ADR-0003
 * amendment), so lists never load originals.
 */

export const MEDIA_CATEGORIES = [
  'TREE_PROFILE',
  'HARVEST_PILE',
  'DEHUSKED_SAMPLE',
  'SALE_LOT',
  'PAYMENT_EVIDENCE',
  'POLYTUNNEL',
  'CROP_PROGRESS',
  'INVENTORY_ITEM',
  'GENERAL',
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

/** Entities photos can be attached to, mapped from their stored entityType. */
export const MEDIA_ENTITY_TYPES = {
  Tree: 'TREE',
  TreeHarvest: 'HARVEST',
  CoconutSample: 'SAMPLE',
  PluckingRound: 'ROUND',
  Sale: 'SALE',
} as const;
export type MediaEntityType =
  (typeof MEDIA_ENTITY_TYPES)[keyof typeof MEDIA_ENTITY_TYPES];

/** Default category for each entity, used when the client doesn't pick one. */
export const DEFAULT_CATEGORY: Record<MediaEntityType, MediaCategory> = {
  TREE: 'TREE_PROFILE',
  HARVEST: 'HARVEST_PILE',
  SAMPLE: 'DEHUSKED_SAMPLE',
  ROUND: 'GENERAL',
  SALE: 'SALE_LOT',
};

export const MEDIA_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
} as const;
export type MediaContentType = keyof typeof MEDIA_CONTENT_TYPES;

export const MEDIA_STATUSES = ['PENDING', 'READY', 'FAILED'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

/** 15 MB per original (ADR-0003). */
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
/** Thumbnails are small WebP/JPEG files. */
export const MAX_THUMB_BYTES = 512 * 1024;
/** Longest edge of a thumbnail, in px. */
export const THUMB_MAX_EDGE = 480;
/** Presigned upload lifetime (seconds). */
export const UPLOAD_URL_TTL = 5 * 60;
/** Presigned view lifetime (seconds). */
export const VIEW_URL_TTL = 10 * 60;

export function isMediaContentType(v: string): v is MediaContentType {
  return Object.prototype.hasOwnProperty.call(MEDIA_CONTENT_TYPES, v);
}

const safe = (label: string, v: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(v))
    throw new Error(`Invalid ${label}: ${JSON.stringify(v)}`);
  return v;
};

export interface MediaObjectKeys {
  original: string;
  thumb: string;
}

/**
 * tenants/{tenantId}/farms/{farmId}/{category}/{entityType}/{entityId}/{mediaId}/original.{ext}
 * and …/thumb.webp (ADR-0003 §2).
 */
export function mediaObjectKeys(p: {
  tenantId: string;
  farmId: string;
  category: MediaCategory;
  entityType: MediaEntityType;
  entityId: string;
  mediaId: string;
  contentType: MediaContentType;
}): MediaObjectKeys {
  const base = [
    'tenants',
    safe('tenantId', p.tenantId),
    'farms',
    safe('farmId', p.farmId),
    safe('category', p.category),
    safe('entityType', p.entityType),
    safe('entityId', p.entityId),
    safe('mediaId', p.mediaId),
  ].join('/');
  return {
    original: `${base}/original.${MEDIA_CONTENT_TYPES[p.contentType]}`,
    thumb: `${base}/thumb`,
  };
}

/** True when `key` lives under the tenant's prefix (defence in depth). */
export function keyBelongsToTenant(key: string, tenantId: string): boolean {
  return key.startsWith(`tenants/${safe('tenantId', tenantId)}/`);
}

/** Scale (w, h) so the longest edge is at most `max`, keeping the ratio. */
export function fitWithin(
  width: number,
  height: number,
  max = THUMB_MAX_EDGE
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
