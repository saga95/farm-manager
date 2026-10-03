import type { Tree } from '@/lib/api';
import { countByStatus, filterTrees } from '../treeFilters';

const tree = (
  code: string,
  status = 'PRODUCING',
  displayLabel?: string
): Tree => ({
  id: code,
  tenantId: 't',
  farmId: 'f',
  code,
  cropCode: 'COCONUT',
  status,
  version: 1,
  ...(displayLabel ? { displayLabel } : {}),
});

const trees = [
  tree('C-001'),
  tree('C-012', 'YOUNG', 'Near the well'),
  tree('C-120'),
];

describe('filterTrees (FR-CN-009)', () => {
  it('matches codes case-insensitively, with or without the hyphen', () => {
    expect(filterTrees(trees, 'c-012', 'ALL').map(t => t.code)).toEqual([
      'C-012',
    ]);
    expect(filterTrees(trees, 'c012', 'ALL').map(t => t.code)).toEqual([
      'C-012',
    ]);
    expect(filterTrees(trees, '12', 'ALL').map(t => t.code)).toEqual([
      'C-012',
      'C-120',
    ]);
  });
  it('matches display labels', () => {
    expect(filterTrees(trees, 'well', 'ALL').map(t => t.code)).toEqual([
      'C-012',
    ]);
  });
  it('filters by status', () => {
    expect(filterTrees(trees, '', 'YOUNG').map(t => t.code)).toEqual(['C-012']);
  });
  it('counts by status', () => {
    expect(countByStatus(trees)).toEqual({ PRODUCING: 2, YOUNG: 1 });
  });
});
