/**
 * Minimal EXIF reader: the original capture time of a JPEG (DateTimeOriginal,
 * tag 0x9003, with OffsetTimeOriginal 0x9011 when present). Backfilled WhatsApp
 * photos keep their real date (§15). Returns null for anything it can't read.
 */

const ASCII = (view: DataView, offset: number, length: number) => {
  let s = '';
  for (let i = 0; i < length; i += 1) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
};

function readIfd(
  view: DataView,
  tiff: number,
  ifd: number,
  little: boolean
): Map<number, { type: number; count: number; valueOffset: number }> {
  const out = new Map<
    number,
    { type: number; count: number; valueOffset: number }
  >();
  const n = view.getUint16(tiff + ifd, little);
  for (let i = 0; i < n; i += 1) {
    const e = tiff + ifd + 2 + i * 12;
    const count = view.getUint32(e + 4, little);
    out.set(view.getUint16(e, little), {
      type: view.getUint16(e + 2, little),
      count,
      // Values longer than 4 bytes live at an offset from the TIFF header.
      valueOffset: count > 4 ? tiff + view.getUint32(e + 8, little) : e + 8,
    });
  }
  return out;
}

/** "2026:09:01 07:30:00" (+ "+05:30") → ISO 8601; local time when no offset. */
export function exifDateToIso(
  value: string,
  offset?: string | null
): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(
    value.trim()
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (offset && /^[+-]\d{2}:\d{2}$/.test(offset))
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
  const local = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

export function readExifCapturedAt(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG
    let p = 2;
    while (p + 4 < view.byteLength) {
      const marker = view.getUint16(p);
      const size = view.getUint16(p + 2);
      if (marker === 0xffe1 && ASCII(view, p + 4, 4) === 'Exif') {
        const tiff = p + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd0 = readIfd(
          view,
          tiff,
          view.getUint32(tiff + 4, little),
          little
        );
        const exifPtr = ifd0.get(0x8769);
        if (!exifPtr) return null;
        const exif = readIfd(
          view,
          tiff,
          view.getUint32(exifPtr.valueOffset, little),
          little
        );
        const dto = exif.get(0x9003);
        if (!dto) return null;
        const off = exif.get(0x9011);
        return exifDateToIso(
          ASCII(view, dto.valueOffset, dto.count),
          off ? ASCII(view, off.valueOffset, off.count) : null
        );
      }
      if ((marker & 0xff00) !== 0xff00) return null;
      p += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

/** Capture time of a photo: EXIF first, then the file's modified time. */
export async function capturedAtOf(file: File): Promise<string | null> {
  if (file.type === 'image/jpeg') {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const exif = readExifCapturedAt(head);
    if (exif) return exif;
  }
  return file.lastModified ? new Date(file.lastModified).toISOString() : null;
}
