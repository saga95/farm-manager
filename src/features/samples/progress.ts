/** Round sampling progress: which harvested trees still need a sample. */

export interface HarvestRef {
  id: string;
  treeId: string;
  treeCode: string;
}
export interface SampleRef {
  harvestId: string;
}

export function samplingProgress(
  harvests: readonly HarvestRef[],
  samples: readonly SampleRef[],
  order: readonly string[] = []
) {
  const sampled = new Set(samples.map(s => s.harvestId));
  const rank = (treeId: string) => {
    const i = order.indexOf(treeId);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...harvests].sort(
    (a, b) =>
      rank(a.treeId) - rank(b.treeId) || a.treeCode.localeCompare(b.treeCode)
  );
  const pending = sorted.filter(h => !sampled.has(h.id));
  return {
    total: harvests.length,
    done: harvests.length - pending.length,
    ordered: sorted,
    /** The next harvest without a sample after `afterHarvestId`, wrapping around. */
    nextAfter(afterHarvestId?: string | null): HarvestRef | null {
      if (pending.length === 0) return null;
      const from = afterHarvestId
        ? sorted.findIndex(h => h.id === afterHarvestId)
        : -1;
      return (
        sorted
          .slice(from + 1)
          .find(h => !sampled.has(h.id) && h.id !== afterHarvestId) ??
        pending.find(h => h.id !== afterHarvestId) ??
        null
      );
    },
  };
}
