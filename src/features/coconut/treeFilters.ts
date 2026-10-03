import { normalizeTreeCode } from '@/domain/coconut';
import type { Tree } from '@/lib/api';

/** FR-CN-009 search by code (and display label), plus optional status filter. */
export function filterTrees(
  trees: readonly Tree[],
  search: string,
  status: string | 'ALL'
): Tree[] {
  const q = normalizeTreeCode(search);
  const loose = search.trim().toLowerCase();
  return trees.filter(t => {
    if (status !== 'ALL' && t.status !== status) return false;
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
