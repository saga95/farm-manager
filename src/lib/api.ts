/**
 * Typed client for the Farm Manager API (custom AppSync operations, ADR-0001).
 * Errors from farm-api arrive as `<CODE>: <detail>` and are mapped to ApiError.
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'INTERNAL'
  | 'NETWORK';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const KNOWN: readonly ApiErrorCode[] = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'INTERNAL',
];

/** Map a GraphQL error message (`CODE: detail`) to an ApiError. */
export function toApiError(message: string | undefined): ApiError {
  const match = /^([A-Z_]+):\s*(.*)$/s.exec(message ?? '');
  const code = match?.[1] as ApiErrorCode | undefined;
  if (code && KNOWN.includes(code)) return new ApiError(code, match?.[2] ?? '');
  if (/unauthorized|not authorized|no current user/i.test(message ?? '')) {
    return new ApiError('UNAUTHENTICATED', message ?? '');
  }
  return new ApiError('INTERNAL', message ?? 'Unexpected error');
}

let client: ReturnType<typeof generateClient<Schema>> | undefined;
const api = () => (client ??= generateClient<Schema>({ authMode: 'userPool' }));

type Result<T> = {
  data?: T | null;
  errors?: readonly { message: string }[] | null;
};

function unwrap<T>(res: Result<T>): T {
  if (res.errors && res.errors.length > 0)
    throw toApiError(res.errors[0]?.message);
  if (res.data === undefined || res.data === null)
    throw new ApiError('INTERNAL', 'Empty response');
  return res.data;
}

export interface Membership {
  tenantId: string;
  tenantName: string;
  profileId: string;
  profileName: string;
  entitlements: string[];
}

export interface Me {
  userId: string;
  email: string | null;
  memberships: Membership[];
}

export async function fetchMe(): Promise<Me> {
  const data = unwrap((await api().queries.me()) as Result<Me>);
  return { ...data, memberships: [...data.memberships] };
}

export interface CreateTenantVariables {
  tenantId: string;
  name: string;
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLocale: string;
  farmId: string;
  farmName: string;
  farmArea?: number | null;
  farmAreaUnit?: string | null;
  farmLocationLabel?: string | null;
}

export async function createTenant(
  variables: CreateTenantVariables
): Promise<{ tenantId: string; farmId: string; replayed: boolean }> {
  return unwrap(
    (await api().mutations.createTenant(variables)) as Result<{
      tenantId: string;
      farmId: string;
      replayed: boolean;
    }>
  );
}

// ─── Farms, zones, growing spaces (#33–#36) ──────────────────────────────────

export interface Farm {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  area?: number | null;
  areaUnit?: string | null;
  locationLabel?: string | null;
  timezone?: string | null;
  status: string;
  version: number;
}

export interface Zone {
  id: string;
  tenantId: string;
  farmId: string;
  name: string;
  zoneType: string;
  description?: string | null;
  area?: number | null;
  areaUnit?: string | null;
  status: string;
  version: number;
}

export interface GrowingSpace {
  id: string;
  tenantId: string;
  farmId: string;
  parentZoneId?: string | null;
  name: string;
  spaceType: string;
  width?: number | null;
  length?: number | null;
  lengthUnit?: string | null;
  calculatedAreaSqM?: number | null;
  sunlightLevel?: string | null;
  shadeLevel?: string | null;
  waterAccess?: string | null;
  drainage?: string | null;
  slope?: string | null;
  surfaceType?: string | null;
  currentUse?: string | null;
  notes?: string | null;
  status: string;
  version: number;
}

/* The generated client is typed from the schema; results are narrowed to our view types. */
type AnyOp = (vars: Record<string, unknown>) => Promise<Result<unknown>>;
const q = (name: string): AnyOp =>
  (api().queries as unknown as Record<string, AnyOp>)[name] as AnyOp;
const mu = (name: string): AnyOp =>
  (api().mutations as unknown as Record<string, AnyOp>)[name] as AnyOp;

export const listFarms = async (tenantId: string) => [
  ...(unwrap(await q('listFarms')({ tenantId })) as Farm[]),
];

export const listZones = async (
  tenantId: string,
  farmId: string,
  includeArchived = false
) => [
  ...(unwrap(
    await q('listZones')({ tenantId, farmId, includeArchived })
  ) as Zone[]),
];

export type ZoneInput = Pick<Zone, 'name' | 'zoneType'> &
  Partial<Pick<Zone, 'description' | 'area' | 'areaUnit'>>;

export const createZone = async (
  tenantId: string,
  farmId: string,
  zoneId: string,
  input: ZoneInput
) =>
  unwrap(
    await mu('createZone')({ tenantId, farmId, zoneId, ...input })
  ) as Zone;

export const updateZone = async (
  tenantId: string,
  zone: Pick<Zone, 'id' | 'farmId' | 'version'>,
  changes: Partial<ZoneInput & { status: string }>
) =>
  unwrap(
    await mu('updateZone')({
      tenantId,
      farmId: zone.farmId,
      zoneId: zone.id,
      expectedVersion: zone.version,
      ...changes,
    })
  ) as Zone;

export const listSpaces = async (
  tenantId: string,
  farmId: string,
  status?: string
) => [
  ...(unwrap(
    await q('listSpaces')({ tenantId, farmId, ...(status ? { status } : {}) })
  ) as GrowingSpace[]),
];

export type SpaceInput = Pick<GrowingSpace, 'name' | 'spaceType'> &
  Partial<
    Omit<
      GrowingSpace,
      | 'id'
      | 'tenantId'
      | 'farmId'
      | 'name'
      | 'spaceType'
      | 'status'
      | 'version'
      | 'calculatedAreaSqM'
    >
  >;

export const createSpace = async (
  tenantId: string,
  farmId: string,
  spaceId: string,
  input: SpaceInput
) =>
  unwrap(
    await mu('createSpace')({ tenantId, farmId, spaceId, ...input })
  ) as GrowingSpace;

export const updateSpace = async (
  tenantId: string,
  space: Pick<GrowingSpace, 'id' | 'farmId' | 'version'>,
  changes: Partial<SpaceInput & { status: string }>
) =>
  unwrap(
    await mu('updateSpace')({
      tenantId,
      farmId: space.farmId,
      spaceId: space.id,
      expectedVersion: space.version,
      ...changes,
    })
  ) as GrowingSpace;
