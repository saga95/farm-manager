/**
 * CSV export (SRS §5.2, #106). Pure: rows + columns → RFC 4180 CSV.
 * Cells that a spreadsheet would treat as a formula (=, +, -, @, tab, CR) are
 * prefixed with an apostrophe (CSV / formula injection), except plain numbers.
 */

export const EXPORT_KINDS = [
  'trees',
  'harvests',
  'samples',
  'sales',
  'stock',
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export interface Column<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(
  v: string | number | boolean | null | undefined
): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(
  rows: readonly T[],
  columns: readonly Column<T>[]
): string {
  const lines = [columns.map(c => csvCell(c.header)).join(',')];
  for (const r of rows)
    lines.push(columns.map(c => csvCell(c.value(r))).join(','));
  // BOM so Excel opens UTF-8 (Sinhala / Tamil names) correctly
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function exportFilename(
  kind: ExportKind,
  farmName: string,
  today: string
): string {
  const safe =
    farmName
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'farm';
  return `${safe}-${kind}-${today}.csv`;
}
