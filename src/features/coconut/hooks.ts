/** Coconut tree registry hooks (React Query). Server enforces tenant + entitlements. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Tree,
  type TreeInput,
  bulkCreateTrees,
  createTree,
  getTree,
  listTrees,
  updateTree,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useTrees(includeInactive = false) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  const query = useQuery({
    queryKey: ['trees', tenantId, farmId, includeInactive],
    queryFn: () => listTrees(tenantId, farmId, includeInactive),
    enabled: Boolean(tenantId && farmId),
  });
  return { ...query, tenantId, farmId };
}

export function useTree(treeId: string | undefined) {
  const { tenantId } = useCurrentFarm();
  return useQuery({
    queryKey: ['tree', tenantId, treeId],
    queryFn: () => getTree(tenantId, treeId as string),
    enabled: Boolean(tenantId && treeId),
    retry: false,
  });
}

export function useCreateTree() {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  return useMutation({
    mutationFn: (args: {
      treeId: string;
      input: TreeInput & { code: string; status: string };
    }) => {
      if (!farm) throw new Error('No farm');
      return createTree(tenantId, farm.id, args.treeId, args.input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trees', tenantId] }),
  });
}

export function useUpdateTree() {
  const qc = useQueryClient();
  const { tenantId } = useCurrentFarm();
  return useMutation({
    mutationFn: (args: { tree: Tree; changes: TreeInput }) =>
      updateTree(tenantId, args.tree, args.changes),
    onSuccess: tree => {
      qc.setQueryData(['tree', tenantId, tree.id], tree);
      return qc.invalidateQueries({ queryKey: ['trees', tenantId] });
    },
  });
}

export function useBulkCreateTrees() {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  return useMutation({
    mutationFn: (input: Parameters<typeof bulkCreateTrees>[2]) => {
      if (!farm) throw new Error('No farm');
      return bulkCreateTrees(tenantId, farm.id, input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trees', tenantId] }),
  });
}
