import { samplingProgress } from '../progress';

const h = (id: string, treeId: string, treeCode: string) => ({
  id,
  treeId,
  treeCode,
});
const harvests = [
  h('h3', 't3', 'C-003'),
  h('h1', 't1', 'C-001'),
  h('h2', 't2', 'C-002'),
];

describe('samplingProgress', () => {
  it('follows the planned walk order and counts sampled harvests', () => {
    const p = samplingProgress(
      harvests,
      [{ harvestId: 'h2' }],
      ['t2', 't3', 't1']
    );
    expect(p.ordered.map(x => x.treeCode)).toEqual(['C-002', 'C-003', 'C-001']);
    expect(p).toMatchObject({ done: 1, total: 3 });
    expect(p.nextAfter(null)?.id).toBe('h3');
  });

  it('Save & next goes to the next unsampled tree, wrapping around', () => {
    const p = samplingProgress(harvests, [{ harvestId: 'h2' }]);
    expect(p.nextAfter('h3')?.id).toBe('h1');
    expect(p.nextAfter('h1')?.id).toBe('h3');
  });

  it('returns null when every harvested tree is sampled', () => {
    const p = samplingProgress(harvests, [
      { harvestId: 'h1' },
      { harvestId: 'h2' },
      { harvestId: 'h3' },
    ]);
    expect(p.done).toBe(3);
    expect(p.nextAfter('h1')).toBeNull();
  });

  it('the tree just saved is not offered again even before the refetch lands', () => {
    const p = samplingProgress([h('h1', 't1', 'C-001')], []);
    expect(p.nextAfter('h1')).toBeNull();
  });
});
