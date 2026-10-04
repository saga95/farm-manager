/** Farm-input hooks (React Query). Separate from produce stock (AC-IN-005). */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type InputItem,
  type InputItemFields,
  createInputItem,
  getInputItem,
  listInputItems,
  recordInputMovement,
  updateInputItem,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useInputItems(includeArchived = false) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  return useQuery({
    queryKey: ['inputs', tenantId, farmId, includeArchived],
    queryFn: () => listInputItems(tenantId, farmId, includeArchived),
    enabled: Boolean(tenantId && farmId),
  });
}

export function useInputItem(itemId: string | undefined) {
  const { tenantId } = useCurrentFarm();
  return useInfiniteQuery({
    queryKey: ['input', tenantId, itemId],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      getInputItem(tenantId, itemId as string, pageParam ?? null),
    getNextPageParam: last => last.nextToken ?? undefined,
    enabled: Boolean(tenantId && itemId),
    retry: false,
  });
}

export function useInputActions(itemId?: string) {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['inputs', tenantId] }),
      qc.invalidateQueries({ queryKey: ['input', tenantId] }),
    ]);
  return {
    create: useMutation({
      mutationFn: (
        a: InputItemFields & {
          itemId: string;
          openingQuantity: number | null;
          openingDate: string;
        }
      ) => {
        if (!farm) throw new Error('No farm');
        return createInputItem(tenantId, { farmId: farm.id, ...a });
      },
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (a: {
        item: InputItem;
        changes: Parameters<typeof updateInputItem>[2];
      }) => updateInputItem(tenantId, a.item, a.changes),
      onSuccess: refresh,
    }),
    move: useMutation({
      mutationFn: (
        a: Omit<Parameters<typeof recordInputMovement>[1], 'itemId'>
      ) => recordInputMovement(tenantId, { itemId: itemId as string, ...a }),
      onSuccess: refresh,
    }),
  };
}
