/** Sales hooks (React Query). Recording a sale also moves stock (§13.5). */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type Sale,
  type SaleFilters,
  type SaleInput,
  archiveSale,
  getSale,
  listSales,
  recordSale,
  restoreSale,
  updateSale,
} from '@/lib/api';
import { useCurrentFarm } from '@/features/farm/hooks';

export function useSales(filters: SaleFilters) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  return useInfiniteQuery({
    queryKey: ['sales', tenantId, farmId, filters],
    queryFn: ({ pageParam }: { pageParam?: string | null }) =>
      listSales(tenantId, farmId, filters, pageParam ?? null),
    getNextPageParam: last => last.nextToken ?? undefined,
    enabled: Boolean(tenantId && farmId),
  });
}

export function useSale(saleId: string | undefined) {
  const { tenantId } = useCurrentFarm();
  return useQuery({
    queryKey: ['sale', tenantId, saleId],
    queryFn: () => getSale(tenantId, saleId as string),
    enabled: Boolean(tenantId && saleId),
    retry: false,
  });
}

export function useSaleActions() {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  const refresh = () =>
    Promise.all(
      [
        ['sales', tenantId],
        ['sale', tenantId],
        ['batches', tenantId],
        ['batch', tenantId],
      ].map(queryKey => qc.invalidateQueries({ queryKey }))
    );
  return {
    record: useMutation({
      mutationFn: (a: SaleInput & { saleId: string; saleDate: string }) => {
        if (!farm) throw new Error('No farm');
        return recordSale(tenantId, { farmId: farm.id, ...a });
      },
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (a: {
        sale: Sale;
        input: SaleInput & { reason: string | null };
      }) => updateSale(tenantId, a.sale, a.input),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (a: { sale: Sale; reason: string | null }) =>
        archiveSale(tenantId, a.sale, a.reason),
      onSuccess: refresh,
    }),
    restore: useMutation({
      mutationFn: (sale: Sale) => restoreSale(tenantId, sale),
      onSuccess: refresh,
    }),
  };
}
