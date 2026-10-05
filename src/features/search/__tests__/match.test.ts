import { type SearchSources, search } from '../match';

const src: SearchSources = {
  trees: [
    { id: 't1', code: 'C-001', status: 'PRODUCING' },
    {
      id: 't14',
      code: 'C-014',
      displayLabel: 'Near the well',
      status: 'PRODUCING',
    },
    { id: 'p1', code: 'P-001', status: 'YOUNG' },
  ],
  rounds: [
    { id: 'r1', roundDate: '2026-03-08' },
    { id: 'r2', roundDate: '2026-05-10', deletedAt: 'x' },
  ],
  buyers: [{ id: 'b1', name: 'Lake View Restaurant', phone: '0771234567' }],
  sales: [
    {
      id: 's1',
      saleDate: '2026-03-12',
      buyerName: 'Lake View Restaurant',
      totalQuantity: 40,
    },
  ],
  inputs: [{ id: 'i1', name: 'Urea', category: 'FERTILIZER' }],
  batches: [
    {
      id: 'b9',
      batchDate: '2026-04-10',
      cropCode: 'CUCUMBER',
      cropName: 'Cucumber',
    },
  ],
  cycles: [{ id: 'c1', name: 'Cucumber 2026-02', cropName: 'Cucumber' }],
};
const fmt = (iso: string) => `formatted ${iso}`;
const kinds = (q: string) => search(q, src, fmt).map(r => `${r.kind}:${r.id}`);

describe('global search (#102)', () => {
  it('finds trees by loose codes and labels', () => {
    expect(kinds('c1')).toEqual(['tree:t1']);
    expect(kinds('C-014')).toEqual(['tree:t14']);
    expect(kinds('14')).toEqual(['tree:t14']);
    expect(kinds('well')).toEqual(['tree:t14']);
    expect(kinds('p1')).toEqual(['tree:p1']);
  });

  it('finds rounds, sales and batches by date; removed rounds are skipped', () => {
    expect(kinds('2026-03')).toEqual(['round:r1', 'sale:s1']);
    expect(kinds('2026-05')).toEqual([]);
    expect(kinds('2026-04-10')).toEqual(['batch:b9']);
  });

  it('finds buyers (and their sales), inputs and crop cycles by name', () => {
    expect(kinds('lake')).toEqual(['buyer:b1', 'sale:s1']);
    expect(kinds('0771')).toEqual(['buyer:b1']);
    expect(kinds('urea')).toEqual(['input:i1']);
    expect(kinds('cucumber')).toEqual(['cycle:c1', 'batch:b9']);
  });

  it('links to each record', () => {
    expect(search('urea', src, fmt)[0]).toMatchObject({
      href: '/inventory/inputs/i1',
      title: 'Urea',
    });
    expect(search('', src, fmt)).toEqual([]);
  });
});
