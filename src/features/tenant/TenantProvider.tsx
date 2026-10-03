/**
 * TenantProvider (#31): loads `me`, keeps the current tenant, and exposes the
 * caller's resolved entitlements. Entitlements here only drive UI visibility;
 * the server enforces them on every operation (ADR-0001 §7).
 */

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { type Me, type Membership, fetchMe } from '@/lib/api';
import { getItem, setItem } from '@/utils/safeStorage';
import { TENANT_STORAGE_KEY, pickTenant } from './selection';

export interface TenantContextValue {
  me: Me | undefined;
  /** True while auth or `me` is loading */
  loading: boolean;
  error: unknown;
  tenant: Membership | null;
  entitlements: ReadonlySet<string>;
  /** UI-only permission check (server enforces separately) */
  can: (entitlement: string) => boolean;
  selectTenant: (tenantId: string) => void;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const ME_QUERY_KEY = ['me'] as const;

export function TenantProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [rememberedId, setRememberedId] = useState<string | null>(() =>
    getItem(TENANT_STORAGE_KEY)
  );

  const meQuery = useQuery({
    queryKey: [...ME_QUERY_KEY, user?.sub ?? 'anonymous'],
    queryFn: fetchMe,
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  });

  const me = isAuthenticated ? meQuery.data : undefined;
  const tenant = useMemo(
    () => pickTenant(me?.memberships ?? [], rememberedId),
    [me, rememberedId]
  );
  const entitlements = useMemo(
    () => new Set(tenant?.entitlements ?? []),
    [tenant]
  );

  const selectTenant = useCallback((tenantId: string) => {
    setItem(TENANT_STORAGE_KEY, tenantId);
    setRememberedId(tenantId);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  }, [queryClient]);

  const value = useMemo<TenantContextValue>(
    () => ({
      me,
      loading: authLoading || (isAuthenticated && meQuery.isLoading),
      error: meQuery.error,
      tenant,
      entitlements,
      can: (e: string) => entitlements.has(e),
      selectTenant,
      refresh,
    }),
    [
      me,
      authLoading,
      isAuthenticated,
      meQuery.isLoading,
      meQuery.error,
      tenant,
      entitlements,
      selectTenant,
      refresh,
    ]
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
