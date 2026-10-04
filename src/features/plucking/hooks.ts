/** Plucking round hooks (React Query). Server enforces tenant + entitlements. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ulid } from 'ulid';
import {
  type PluckingRound,
  type PluckingRoundDetail,
  type TreeHarvest,
  archivePluckingRound,
  archiveTreeHarvest,
  completePluckingRound,
  correctTreeHarvest,
  createPluckingRound,
  getPluckingRound,
  listPluckingRounds,
  recordTreeHarvest,
  restorePluckingRound,
  restoreTreeHarvest,
  updateRoundPlan,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useRounds(includeDeleted = false) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  return useQuery({
    queryKey: ['rounds', tenantId, farmId, includeDeleted],
    queryFn: () => listPluckingRounds(tenantId, farmId, includeDeleted),
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

/**
 * Corrections after the fact (#56, #57): fix a count on a completed round,
 * remove/restore a harvest or a whole round. Each one can change stock, tree
 * history and predictions, so they all refresh those too.
 */
export function useRoundCorrections(roundId: string | undefined) {
  const qc = useQueryClient();
  const { tenantId } = useCurrentFarm();
  const refresh = () =>
    Promise.all(
      [
        ['round', tenantId, roundId],
        ['rounds', tenantId],
        ['batches', tenantId],
        ['treeHistory', tenantId],
        ['dueTrees', tenantId],
        ['trees', tenantId],
      ].map(queryKey => qc.invalidateQueries({ queryKey }))
    );

  return {
    correct: useMutation({
      mutationFn: (a: {
        harvest: TreeHarvest;
        quantity: number;
        reason: string | null;
      }) => correctTreeHarvest(tenantId, a.harvest, a),
      onSuccess: refresh,
    }),
    removeHarvest: useMutation({
      mutationFn: (a: { harvest: TreeHarvest; reason: string | null }) =>
        archiveTreeHarvest(tenantId, a.harvest, a.reason),
      onSuccess: refresh,
    }),
    restoreHarvest: useMutation({
      mutationFn: (harvest: TreeHarvest) =>
        restoreTreeHarvest(tenantId, harvest),
      onSuccess: refresh,
    }),
    removeRound: useMutation({
      mutationFn: (a: { round: PluckingRound; reason: string | null }) =>
        archivePluckingRound(tenantId, a.round, a.reason),
      onSuccess: refresh,
    }),
    restoreRound: useMutation({
      mutationFn: (round: PluckingRound) =>
        restorePluckingRound(tenantId, round),
      onSuccess: refresh,
    }),
  };
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
