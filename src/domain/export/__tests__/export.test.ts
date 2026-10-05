import { csvCell, exportFilename, toCsv } from '..';

describe('CSV export (#106)', () => {
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('C-001')).toBe('C-001');
    expect(csvCell('Lake View, Kandy')).toBe('"Lake View, Kandy"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(-3)).toBe('-3');
  });

  it('neutralises spreadsheet formulas in text', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+94 77 123')).toBe("'+94 77 123");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('builds a CSV with a header and a UTF-8 BOM', () => {
    const csv = toCsv(
      [{ code: 'C-001', n: 20 }],
      [
        { header: 'Tree', value: r => r.code },
        { header: 'Nuts', value: r => r.n },
      ]
    );
    expect(csv).toBe('﻿Tree,Nuts\r\nC-001,20\r\n');
  });

  it('names files safely', () => {
    expect(exportFilename('sales', 'Sagara Farm / Home', '2026-10-05')).toBe(
      'Sagara-Farm-Home-sales-2026-10-05.csv'
    );
  });
});
