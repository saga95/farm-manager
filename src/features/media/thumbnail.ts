/**
 * Device-side thumbnail (ADR-0003 amendment 1): ≤ 480 px on the long edge,
 * WebP where the browser can encode it, otherwise JPEG (Safari). Re-encoding
 * through a canvas drops all EXIF, so thumbnails never carry GPS.
 */

import { fitWithin } from '@/domain/media';

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

export async function makeThumbnail(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const webp = await toBlob(canvas, 'image/webp', 0.8);
    if (webp && webp.type === 'image/webp') return webp;
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.8);
    if (!jpeg) throw new Error('Could not encode thumbnail');
    return jpeg;
  } finally {
    bitmap.close();
  }
}
