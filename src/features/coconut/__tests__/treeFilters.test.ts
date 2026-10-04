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

describe('size filter (§9.4 buyer matching)', () => {
  const mk = (
    code: string,
    latestSampleSize: string | null,
    sizeTendency: string | null
  ): Tree => ({
    id: code,
    tenantId: 't',
    farmId: 'f',
    code,
    cropCode: 'COCONUT',
    status: 'PRODUCING',
    version: 1,
    latestSampleSize,
    sizeTendency,
  });
  const trees = [
    mk('C-001', 'LARGE', null),
    mk('C-002', 'MEDIUM', 'LARGE'),
    mk('C-003', 'SMALL', 'SMALL'),
    mk('C-004', null, null),
  ];

  it('matches on latest sample OR recent tendency; never on unsampled trees', () => {
    expect(filterTrees(trees, '', 'ALL', 'LARGE').map(t => t.code)).toEqual([
      'C-001',
      'C-002',
    ]);
    expect(filterTrees(trees, '', 'ALL', 'SMALL').map(t => t.code)).toEqual([
      'C-003',
    ]);
    expect(filterTrees(trees, '', 'ALL', 'ANY')).toHaveLength(4);
  });
});
