/** Analytics report hook (React Query). */

import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export type PeriodKey = '3m' | '12m' | 'year' | 'all';

/** Inclusive period ending today (farm-local date passed in). */
export function periodFor(
  key: PeriodKey,
  today: string
): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const monthsBack = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1), 1));
    return d.toISOString().slice(0, 10);
  };
  if (key === '3m') return { from: monthsBack(3), to: today };
  if (key === '12m') return { from: monthsBack(12), to: today };
  if (key === 'year') return { from: `${y}-01-01`, to: today };
  return { from: '2000-01-01', to: today };
}

export function useAnalytics(
  period: { from: string; to: string },
  includeNonProducing: boolean
) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  return useQuery({
    queryKey: ['analytics', tenantId, farmId, period, includeNonProducing],
    queryFn: () => getAnalytics(tenantId, farmId, period, includeNonProducing),
    enabled: Boolean(tenantId && farmId),
    staleTime: 60_000,
  });
}
