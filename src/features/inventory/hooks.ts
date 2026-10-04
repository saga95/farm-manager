/** Produce stock hooks (React Query). Server enforces tenant + entitlements. */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ulid } from 'ulid';
import {
  type ProduceState,
  dehuskProduce,
  getProduceBatch,
  listProduceBatches,
  recordProduceMovement,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useProduceBatches(availableOnly = true) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  return useQuery({
    queryKey: ['batches', tenantId, farmId, availableOnly],
    queryFn: () => listProduceBatches(tenantId, farmId, availableOnly),
    enabled: Boolean(tenantId && farmId),
  });
}

/** Batch + movement history, newest first, one page at a time (#79). */
export function useProduceBatch(batchId: string | undefined) {
  const { tenantId } = useCurrentFarm();
  return useInfiniteQuery({
    queryKey: ['batch', tenantId, batchId],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      getProduceBatch(tenantId, batchId as string, pageParam ?? null),
    getNextPageParam: last => last.nextToken ?? undefined,
    enabled: Boolean(tenantId && batchId),
    retry: false,
  });
}

export interface MovementInput {
  transactionType: string;
  quantity: number;
  state: ProduceState;
  transactionDate: string;
  notes: string | null;
}

/**
 * Stock actions on one batch. Each call gets ONE operation id for its lifetime,
 * so a retry after a lost response can never move stock twice (AC-DH-004).
 */
export function useStockActions(batchId: string | undefined) {
  const qc = useQueryClient();
  const { tenantId } = useCurrentFarm();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['batch', tenantId, batchId] }),
      qc.invalidateQueries({ queryKey: ['batches', tenantId] }),
    ]);

  const move = useMutation({
    mutationFn: (a: MovementInput & { operationId: string }) =>
      recordProduceMovement(tenantId, { batchId: batchId as string, ...a }),
    onSuccess: refresh,
  });
  const dehusk = useMutation({
    mutationFn: (a: {
      operationId: string;
      quantity: number;
      transactionDate: string;
      notes: string | null;
    }) => dehuskProduce(tenantId, { batchId: batchId as string, ...a }),
    onSuccess: refresh,
  });
  return { move, dehusk, newOperationId: ulid };
}
