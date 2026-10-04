/** Production cycle & activity hooks (React Query). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ActivityInput,
  type CycleFields,
  type FarmActivity,
  type ProductionCycle,
  archiveActivity,
  createCycle,
  getCycle,
  listCycles,
  recordActivity,
  updateCycle,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useCycles(includeClosed = false) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  return useQuery({
    queryKey: ['cycles', tenantId, farmId, includeClosed],
    queryFn: () => listCycles(tenantId, farmId, includeClosed),
    enabled: Boolean(tenantId && farmId),
  });
}

export function useCycle(cycleId: string | undefined) {
  const { tenantId } = useCurrentFarm();
  return useQuery({
    queryKey: ['cycle', tenantId, cycleId],
    queryFn: () => getCycle(tenantId, cycleId as string),
    enabled: Boolean(tenantId && cycleId),
    retry: false,
  });
}

export function useCycleActions() {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  const refresh = () =>
    Promise.all(
      [
        ['cycles', tenantId],
        ['cycle', tenantId],
        ['inputs', tenantId],
        ['input', tenantId],
      ].map(queryKey => qc.invalidateQueries({ queryKey }))
    );
  return {
    create: useMutation({
      mutationFn: (a: CycleFields & { cycleId: string; status: string }) => {
        if (!farm) throw new Error('No farm');
        return createCycle(tenantId, { farmId: farm.id, ...a });
      },
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (a: {
        cycle: ProductionCycle;
        changes: Parameters<typeof updateCycle>[2];
      }) => updateCycle(tenantId, a.cycle, a.changes),
      onSuccess: refresh,
    }),
    record: useMutation({
      mutationFn: (a: ActivityInput) => recordActivity(tenantId, a),
      onSuccess: refresh,
    }),
    removeActivity: useMutation({
      mutationFn: (a: FarmActivity) => archiveActivity(tenantId, a),
      onSuccess: refresh,
    }),
  };
}
