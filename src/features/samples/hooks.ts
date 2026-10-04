/** Dehusked sample hooks (React Query). Samples never touch inventory (§41.6). */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ulid } from 'ulid';
import {
  type CoconutSample,
  type PluckingRoundDetail,
  recordCoconutSample,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useRecordSample(roundId: string | undefined) {
  const qc = useQueryClient();
  const { tenantId } = useCurrentFarm();
  const key = ['round', tenantId, roundId];
  return useMutation({
    mutationFn: (input: {
      harvestId: string;
      sizeClass: string;
      weight: number | null;
    }) =>
      recordCoconutSample(tenantId, {
        harvestId: input.harvestId,
        sampleId: ulid(),
        sizeClass: input.sizeClass,
        weight: input.weight,
      }),
    onSuccess: (sample: CoconutSample) => {
      // Optimistic merge so "Save & next tree" moves on instantly
      qc.setQueryData<PluckingRoundDetail>(key, prev =>
        prev
          ? {
              ...prev,
              samples: [
                ...(prev.samples ?? []).filter(
                  s => s.harvestId !== sample.harvestId
                ),
                sample,
              ],
            }
          : prev
      );
      void qc.invalidateQueries({
        queryKey: ['treeHistory', tenantId, sample.treeId],
      });
      void qc.invalidateQueries({ queryKey: ['trees', tenantId] });
      return qc.invalidateQueries({ queryKey: key });
    },
  });
}
