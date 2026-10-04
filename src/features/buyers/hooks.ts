/** Buyer hooks (React Query). Buyers are tenant-level (§13.1). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Buyer,
  type BuyerFields,
  createBuyer,
  getBuyer,
  listBuyers,
  updateBuyer,
} from '@/lib/api';
import { useTenant } from '@/features/tenant';

const useTenantId = () => useTenant().tenant?.tenantId ?? '';

export function useBuyers(includeArchived = false) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['buyers', tenantId, includeArchived],
    queryFn: () => listBuyers(tenantId, includeArchived),
    enabled: Boolean(tenantId),
  });
}

export function useBuyer(buyerId: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['buyer', tenantId, buyerId],
    queryFn: () => getBuyer(tenantId, buyerId as string),
    enabled: Boolean(tenantId && buyerId),
    retry: false,
  });
}

export function useBuyerActions() {
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['buyers', tenantId] }),
      qc.invalidateQueries({ queryKey: ['buyer', tenantId] }),
    ]);
  return {
    create: useMutation({
      mutationFn: (a: { buyerId: string; fields: BuyerFields }) =>
        createBuyer(tenantId, a.buyerId, a.fields),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (a: {
        buyer: Buyer;
        changes: Parameters<typeof updateBuyer>[2];
      }) => updateBuyer(tenantId, a.buyer, a.changes),
      onSuccess: refresh,
    }),
  };
}
