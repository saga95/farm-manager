/**
 * Farm feature data hooks (React Query). The repository is the typed API client;
 * all tenant scoping is enforced on the server (ADR-0001).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ulid } from 'ulid';
import {
  type GrowingSpace,
  type SpaceInput,
  type Zone,
  type ZoneInput,
  createSpace,
  createZone,
  listFarms,
  listSpaces,
  listZones,
  updateSpace,
  updateZone,
} from '@/lib/api';
import { useTenant } from '@/features/tenant';

const farmKeys = {
  farms: (tenantId: string) => ['farms', tenantId] as const,
  zones: (tenantId: string, farmId: string) =>
    ['zones', tenantId, farmId] as const,
  spaces: (tenantId: string, farmId: string) =>
    ['spaces', tenantId, farmId] as const,
};

/** V1: one farm per tenant is the norm; use the first active farm. */
export function useCurrentFarm() {
  const { tenant } = useTenant();
  const tenantId = tenant?.tenantId ?? '';
  const query = useQuery({
    queryKey: farmKeys.farms(tenantId),
    queryFn: () => listFarms(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60_000,
  });
  return {
    tenantId,
    farm: query.data?.[0],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useZones(includeArchived = false) {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  const query = useQuery({
    queryKey: [...farmKeys.zones(tenantId, farmId), includeArchived],
    queryFn: () => listZones(tenantId, farmId, includeArchived),
    enabled: Boolean(tenantId && farmId),
  });
  return { ...query, tenantId, farmId };
}

export function useSpaces() {
  const { tenantId, farm } = useCurrentFarm();
  const farmId = farm?.id ?? '';
  const query = useQuery({
    queryKey: farmKeys.spaces(tenantId, farmId),
    queryFn: () => listSpaces(tenantId, farmId),
    enabled: Boolean(tenantId && farmId),
  });
  return { ...query, tenantId, farmId };
}

/** Create or update a zone. A new zone gets a client ULID so retries replay (ADR-0004). */
export function useSaveZone() {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  return useMutation({
    mutationFn: async (args: {
      zone?: Zone | undefined;
      input: Partial<ZoneInput & { status: string }>;
      newId?: string;
    }) => {
      if (!farm) throw new Error('No farm');
      if (args.zone) return updateZone(tenantId, args.zone, args.input);
      return createZone(
        tenantId,
        farm.id,
        args.newId ?? ulid(),
        args.input as ZoneInput
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones', tenantId] }),
  });
}

export function useSaveSpace() {
  const qc = useQueryClient();
  const { tenantId, farm } = useCurrentFarm();
  return useMutation({
    mutationFn: async (args: {
      space?: GrowingSpace | undefined;
      input: Partial<SpaceInput & { status: string }>;
      newId?: string;
    }) => {
      if (!farm) throw new Error('No farm');
      if (args.space) return updateSpace(tenantId, args.space, args.input);
      return createSpace(
        tenantId,
        farm.id,
        args.newId ?? ulid(),
        args.input as SpaceInput
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spaces', tenantId] }),
  });
}
