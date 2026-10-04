/**
 * Private media bucket access (ADR-0003). The ONLY module that talks to S3, so
 * tests can replace it. Every key passed in must come from mediaObjectKeys(),
 * which is tenant-prefixed; we assert that again here (defence in depth).
 */

import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  UPLOAD_URL_TTL,
  VIEW_URL_TTL,
  keyBelongsToTenant,
} from '../../../../src/domain/media';

const s3 = new S3Client({});

function bucket(): string {
  const name = process.env['MEDIA_BUCKET_NAME'];
  if (!name) throw new Error('MEDIA_BUCKET_NAME is not set');
  return name;
}

function guard(key: string, tenantId: string): string {
  if (!keyBelongsToTenant(key, tenantId))
    throw new Error('Object key outside tenant prefix');
  return key;
}

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
}

/**
 * Presigned POST locked to one key and a size range, and either one exact
 * content type or (for thumbnails) any `image/*` type the client sets.
 */
export async function presignUpload(
  tenantId: string,
  key: string,
  contentType: string | { startsWith: string },
  maxBytes: number
): Promise<PresignedUpload> {
  const exact = typeof contentType === 'string';
  return createPresignedPost(s3, {
    Bucket: bucket(),
    Key: guard(key, tenantId),
    Conditions: [
      ['content-length-range', 1, maxBytes],
      exact
        ? ['eq', '$Content-Type', contentType]
        : ['starts-with', '$Content-Type', contentType.startsWith],
    ],
    ...(exact ? { Fields: { 'Content-Type': contentType } } : {}),
    Expires: UPLOAD_URL_TTL,
  });
}

/** Presigned GET for viewing (thumbnail or original). */
export async function presignView(
  tenantId: string,
  key: string
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket(), Key: guard(key, tenantId) }),
    { expiresIn: VIEW_URL_TTL }
  );
}

/** Size of a stored object, or null when it isn't there (yet). */
export async function objectSize(
  tenantId: string,
  key: string
): Promise<number | null> {
  try {
    const res = await s3.send(
      new HeadObjectCommand({ Bucket: bucket(), Key: guard(key, tenantId) })
    );
    return res.ContentLength ?? 0;
  } catch (e) {
    if (e instanceof NotFound || (e as { name?: string }).name === 'NotFound')
      return null;
    throw e;
  }
}
