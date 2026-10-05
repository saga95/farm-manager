import { periodFor } from '../hooks';

describe('report periods', () => {
  it('ends today and starts on the first of the month', () => {
    expect(periodFor('3m', '2026-10-05')).toEqual({
      from: '2026-08-01',
      to: '2026-10-05',
    });
    expect(periodFor('12m', '2026-10-05')).toEqual({
      from: '2025-11-01',
      to: '2026-10-05',
    });
    expect(periodFor('year', '2026-10-05')).toEqual({
      from: '2026-01-01',
      to: '2026-10-05',
    });
    expect(periodFor('12m', '2026-01-15')).toEqual({
      from: '2025-02-01',
      to: '2026-01-15',
    });
  });
});
