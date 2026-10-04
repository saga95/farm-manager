/** Plucking round hooks (React Query). Server enforces tenant + entitlements. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ulid } from 'ulid';
import {
  type PluckingRound,
  type PluckingRoundDetail,
  completePluckingRound,
  createPluckingRound,
  getPluckingRound,
  listPluckingRounds,
  recordTreeHarvest,
  updateRoundPlan,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useRounds() {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  return useQuery({
    queryKey: ['rounds', tenantId, farmId],
    queryFn: () => listPluckingRounds(tenantId, farmId),
    enabled: Boolean(tenantId && farmId),
  });
}

export function useRound(roundId: string | undefined) {
  const { tenantId } = useCurrentFarm();
  return useQuery({
    queryKey: ['round', tenantId, roundId],
    queryFn: () => getPluckingRound(tenantId, roundId as string),
    enabled: Boolean(tenantId && roundId),
    retry: false,
  });
}

export function useCreateRound() {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  return useMutation({
    mutationFn: (input: {
      roundId: string;
      roundDate: string;
      plannedTreeIds: string[];
      pluckerName?: string | null;
    }) => {
      if (!farm) throw new Error('No farm');
      return createPluckingRound(tenantId, { farmId: farm.id, ...input });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rounds', tenantId] }),
  });
}

/** Mutations on an open round; each refreshes the round detail. */
export function useRoundActions(roundId: string | undefined) {
  const qc = useQueryClient();
  const { tenantId } = useCurrentFarm();
  const key = ['round', tenantId, roundId];
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const record = useMutation({
    mutationFn: (input: {
      treeId: string;
      quantity: number;
      approximate: boolean;
      harvestId?: string;
    }) =>
      recordTreeHarvest(tenantId, {
        roundId: roundId as string,
        treeId: input.treeId,
        harvestId: input.harvestId ?? ulid(),
        quantity: input.quantity,
        recordQuality: input.approximate ? 'APPROXIMATE' : 'CONFIRMED',
      }),
    onSuccess: harvest => {
      // Optimistic merge so Save & Next moves on instantly
      qc.setQueryData<PluckingRoundDetail>(key, prev =>
        prev
          ? {
              ...prev,
              harvests: [
                ...prev.harvests.filter(h => h.treeId !== harvest.treeId),
                harvest,
              ],
            }
          : prev
      );
      return refresh();
    },
  });

  const plan = useMutation({
    mutationFn: (args: {
      round: PluckingRound;
      changes: Parameters<typeof updateRoundPlan>[2];
    }) => updateRoundPlan(tenantId, args.round, args.changes),
    onSuccess: round => {
      qc.setQueryData<PluckingRoundDetail>(key, prev =>
        prev ? { ...prev, round } : prev
      );
      return refresh();
    },
  });

  const complete = useMutation({
    mutationFn: (round: PluckingRound) =>
      completePluckingRound(tenantId, round),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rounds', tenantId] });
      return refresh();
    },
  });

  return { record, plan, complete };
}

/** Today's date in the farm's local calendar (YYYY-MM-DD). */
export function todayIso(timeZone?: string | null): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone ?? undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}
