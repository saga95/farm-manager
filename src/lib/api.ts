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
// ─── Coconut tree registry (#40–#45) ─────────────────────────────────────────

export interface Tree {
  id: string;
  tenantId: string;
  farmId: string;
  code: string;
  displayLabel?: string | null;
  cropCode: string;
  zoneId?: string | null;
  status: string;
  variety?: string | null;
  plantedAt?: string | null;
  locationNote?: string | null;
  notes?: string | null;
  coverPhotoId?: string | null;
  version: number;
  createdAt?: string | null;
}

export type TreeInput = Partial<
  Pick<
    Tree,
    | 'displayLabel'
    | 'zoneId'
    | 'variety'
    | 'plantedAt'
    | 'locationNote'
    | 'notes'
    | 'status'
  >
>;

export const listTrees = async (
  tenantId: string,
  farmId: string,
  includeInactive = false
) => [
  ...(unwrap(
    await q('listTrees')({ tenantId, farmId, includeInactive })
  ) as Tree[]),
];

export const getTree = async (tenantId: string, treeId: string) =>
  unwrap(await q('getTree')({ tenantId, treeId })) as Tree;

export const createTree = async (
  tenantId: string,
  farmId: string,
  treeId: string,
  input: TreeInput & { code: string; status: string }
) =>
  unwrap(
    await mu('createTree')({ tenantId, farmId, treeId, ...input })
  ) as Tree;

export const updateTree = async (
  tenantId: string,
  tree: Pick<Tree, 'farmId' | 'code' | 'version'>,
  changes: TreeInput
) =>
  unwrap(
    await mu('updateTree')({
      tenantId,
      farmId: tree.farmId,
      code: tree.code,
      expectedVersion: tree.version,
      ...changes,
    })
  ) as Tree;

export interface BulkCreateTreesResult {
  created: { id: string; code: string }[];
  skipped: string[];
}

export const bulkCreateTrees = async (
  tenantId: string,
  farmId: string,
  input: {
    prefix: string;
    start: number;
    count: number;
    width: number;
    status: string;
    zoneId?: string | null;
  }
) =>
  unwrap(
    await mu('bulkCreateTrees')({ tenantId, farmId, ...input })
  ) as BulkCreateTreesResult;

// ─── Plucking rounds (#51–#55) ───────────────────────────────────────────────

export interface PluckingRound {
  id: string;
  tenantId: string;
  farmId: string;
  roundDate: string;
  plannedTreeIds: string[];
  skippedTreeIds: string[];
  status: string;
  pluckerName?: string | null;
  notes?: string | null;
  totalNuts?: number | null;
  batchId?: string | null;
  completedAt?: string | null;
  version: number;
  createdAt?: string | null;
}

export interface TreeHarvest {
  id: string;
  roundId?: string | null;
  treeId: string;
  treeCode: string;
  harvestDate: string;
  quantity?: number | null;
  recordQuality: string;
  notes?: string | null;
  version: number;
}

export interface PluckingRoundDetail {
  round: PluckingRound;
  harvests: TreeHarvest[];
}

export const listPluckingRounds = async (tenantId: string, farmId: string) => [
  ...(unwrap(
    await q('listPluckingRounds')({ tenantId, farmId })
  ) as PluckingRound[]),
];

export const getPluckingRound = async (tenantId: string, roundId: string) => {
  const d = unwrap(
    await q('getPluckingRound')({ tenantId, roundId })
  ) as PluckingRoundDetail;
  return { round: d.round, harvests: [...d.harvests] };
};

export const createPluckingRound = async (
  tenantId: string,
  input: {
    farmId: string;
    roundId: string;
    roundDate: string;
    plannedTreeIds: string[];
    pluckerName?: string | null;
  }
) =>
  unwrap(
    await mu('createPluckingRound')({ tenantId, ...input })
  ) as PluckingRound;

export const updateRoundPlan = async (
  tenantId: string,
  round: Pick<PluckingRound, 'id' | 'version'>,
  changes: {
    addTreeIds?: string[];
    removeTreeIds?: string[];
    skipTreeIds?: string[];
    unskipTreeIds?: string[];
  }
) =>
  unwrap(
    await mu('updateRoundPlan')({
      tenantId,
      roundId: round.id,
      expectedVersion: round.version,
      ...changes,
    })
  ) as PluckingRound;

export const recordTreeHarvest = async (
  tenantId: string,
  input: {
    roundId: string;
    treeId: string;
    harvestId: string;
    quantity: number;
    recordQuality?: string;
    notes?: string | null;
  }
) =>
  unwrap(await mu('recordTreeHarvest')({ tenantId, ...input })) as TreeHarvest;

export const completePluckingRound = async (
  tenantId: string,
  round: Pick<PluckingRound, 'id' | 'version'>
) =>
  unwrap(
    await mu('completePluckingRound')({
      tenantId,
      roundId: round.id,
      expectedVersion: round.version,
    })
  ) as PluckingRound;
