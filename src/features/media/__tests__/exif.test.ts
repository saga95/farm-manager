import { exifDateToIso, readExifCapturedAt } from '../exif';

/** Build a minimal little-endian JPEG with APP1/Exif → ExifIFD → DateTimeOriginal (+ offset). */
function jpegWithExif(date: string, offset?: string): ArrayBuffer {
  const bytes: number[] = [];
  const u16 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v: number) =>
    bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const ascii = (s: string) => {
    for (const c of s) bytes.push(c.charCodeAt(0));
    bytes.push(0);
  };
  // TIFF header
  bytes.push(0x49, 0x49);
  u16(42);
  u32(8);
  // IFD0 at 8: one entry → ExifIFD pointer
  u16(1);
  u16(0x8769);
  u16(4);
  u32(1);
  u32(26);
  u32(0);
  // Exif IFD at 26
  const entries = offset ? 2 : 1;
  u16(entries);
  const dataStart = 26 + 2 + entries * 12 + 4;
  u16(0x9003);
  u16(2);
  u32(20);
  u32(dataStart);
  if (offset) {
    u16(0x9011);
    u16(2);
    u32(7);
    u32(dataStart + 20);
  }
  u32(0);
  ascii(date);
  if (offset) ascii(offset);
  const tiff = bytes;
  const app1 = [0xff, 0xe1, 0, 0, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length - 2;
  app1[2] = (len >> 8) & 0xff;
  app1[3] = len & 0xff;
  return new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xd9]).buffer;
}

describe('EXIF capture date (§15: backfilled photos keep their date)', () => {
  it('reads DateTimeOriginal with its offset', () => {
    expect(
      readExifCapturedAt(jpegWithExif('2024:05:17 06:45:10', '+05:30'))
    ).toBe('2024-05-17T06:45:10+05:30');
  });

  it('reads DateTimeOriginal without an offset as device-local time', () => {
    const iso = readExifCapturedAt(jpegWithExif('2024:05:17 06:45:10'));
    expect(iso).toBe(new Date(2024, 4, 17, 6, 45, 10).toISOString());
  });

  it('returns null for non-JPEGs and JPEGs without EXIF', () => {
    expect(
      readExifCapturedAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)
    ).toBeNull();
    expect(
      readExifCapturedAt(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)
    ).toBeNull();
    expect(exifDateToIso('not a date')).toBeNull();
  });
});
