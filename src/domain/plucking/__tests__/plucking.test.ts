import {
  isValidQuantity,
  nextPendingTree,
  roundEntries,
  roundTotal,
  summarizeRound,
} from '..';

describe('round checklist (plan first, pluck in any order)', () => {
  const planned = ['t12', 't3', 't40', 't7'];

  it('keeps the planned order and marks recorded / skipped / pending', () => {
    const entries = roundEntries(
      planned,
      ['t40'],
      [{ treeId: 't3', quantity: 13 }]
    );
    expect(entries).toEqual([
      { treeId: 't12', state: 'PENDING' },
      { treeId: 't3', state: 'RECORDED' },
      { treeId: 't40', state: 'SKIPPED' },
      { treeId: 't7', state: 'PENDING' },
    ]);
  });

  it('appends trees recorded on the spot that were not planned', () => {
    const entries = roundEntries(['t1'], [], [{ treeId: 't9', quantity: 4 }]);
    expect(entries.map(e => e.treeId)).toEqual(['t1', 't9']);
  });

  it('recorded wins over skipped; deleted or missing quantities are not "recorded"', () => {
    const entries = roundEntries(
      ['t1', 't2'],
      ['t1'],
      [
        { treeId: 't1', quantity: 5 },
        { treeId: 't2', quantity: 8, deletedAt: '2026-10-04' },
      ]
    );
    expect(entries.map(e => e.state)).toEqual(['RECORDED', 'PENDING']);
  });
});

describe('Save & Next', () => {
  const e = (ids: [string, 'PENDING' | 'RECORDED' | 'SKIPPED'][]) =>
    ids.map(([treeId, state]) => ({ treeId, state }));

  it('goes to the next pending tree in planned order, not the next code number', () => {
    const entries = e([
      ['t12', 'RECORDED'],
      ['t3', 'PENDING'],
      ['t40', 'SKIPPED'],
      ['t7', 'PENDING'],
    ]);
    expect(nextPendingTree(entries, 't12')).toBe('t3');
    expect(nextPendingTree(entries, 't3')).toBe('t7');
  });

  it('wraps around to earlier pending trees the plucker skipped past', () => {
    const entries = e([
      ['t1', 'PENDING'],
      ['t2', 'RECORDED'],
      ['t3', 'RECORDED'],
    ]);
    expect(nextPendingTree(entries, 't3')).toBe('t1');
  });

  it('returns null when nothing is pending', () => {
    expect(
      nextPendingTree(
        e([
          ['t1', 'RECORDED'],
          ['t2', 'SKIPPED'],
        ]),
        't1'
      )
    ).toBeNull();
  });

  it('starts at the first pending tree without a current tree', () => {
    expect(
      nextPendingTree(
        e([
          ['t1', 'RECORDED'],
          ['t2', 'PENDING'],
        ])
      )
    ).toBe('t2');
  });
});

describe('totals (CALC-001, AC-PR-004)', () => {
  it('13 + 18 + 9 + 20 = 60', () => {
    expect(
      roundTotal(
        [13, 18, 9, 20].map((quantity, i) => ({ treeId: `t${i}`, quantity }))
      )
    ).toBe(60);
  });

  it('ignores deleted and unrecorded harvests; counts recorded zero as zero', () => {
    expect(
      roundTotal([
        { treeId: 'a', quantity: 10 },
        { treeId: 'b', quantity: null },
        { treeId: 'c', quantity: 0 },
        { treeId: 'd', quantity: 7, deletedAt: 'x' },
      ])
    ).toBe(10);
  });

  it('summarises a round', () => {
    const entries = roundEntries(
      ['a', 'b', 'c'],
      ['c'],
      [{ treeId: 'a', quantity: 12 }]
    );
    expect(summarizeRound(entries, [{ treeId: 'a', quantity: 12 }])).toEqual({
      planned: 3,
      recorded: 1,
      skipped: 1,
      pending: 1,
      totalNuts: 12,
    });
  });
});

describe('quantity', () => {
  it.each([
    [0, true],
    [13, true],
    [500, true],
    [501, false],
    [-1, false],
    [2.5, false],
    ['13', false],
  ])('%p → %p', (q, ok) => {
    expect(isValidQuantity(q)).toBe(ok);
  });
});
