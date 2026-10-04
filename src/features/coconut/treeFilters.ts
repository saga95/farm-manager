import { normalizeTreeCode } from '@/domain/coconut';
import { type ClassifiedSize, suggestsSize } from '@/domain/samples';
import type { Tree } from '@/lib/api';

/** Does the tree's sample evidence suggest `size` (latest sample or tendency)? */
export function treeSuggestsSize(tree: Tree, size: ClassifiedSize): boolean {
  return suggestsSize(
    {
      latest: (tree.latestSampleSize ?? null) as ClassifiedSize | null,
      tendency: (tree.sizeTendency ?? null) as ClassifiedSize | null,
    },
    size
  );
}

/**
 * FR-CN-009 search by code (and display label), plus optional status filter
 * and a sample-based size filter for buyer matching (§9.4, US-011).
 */
export function filterTrees(
  trees: readonly Tree[],
  search: string,
  status: string | 'ALL',
  size: ClassifiedSize | 'ANY' = 'ANY'
): Tree[] {
  const q = normalizeTreeCode(search);
  const loose = search.trim().toLowerCase();
  return trees.filter(t => {
    if (status !== 'ALL' && t.status !== status) return false;
    if (size !== 'ANY' && !treeSuggestsSize(t, size)) return false;
    if (!q) return true;
    return (
      t.code.includes(q) ||
      t.code.replace(/-/g, '').includes(q.replace(/-/g, '')) ||
      (t.displayLabel ?? '').toLowerCase().includes(loose)
    );
  });
}

/** Count per status for filter chips. */
export function countByStatus(trees: readonly Tree[]): Record<string, number> {
  return trees.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
}
