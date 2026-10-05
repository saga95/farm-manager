/**
 * Typed client for the Farm Manager API (custom AppSync operations, ADR-0001).
 * Errors from farm-api arrive as `<CODE>: <detail>` and are mapped to ApiError.
 */

import { generateClient } from 'aws-amplify/data';
import {
  type ProduceState,
  type StockByState,
  stockOf,
} from '@/domain/inventory';

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

type AnyOp = (vars?: Record<string, unknown>) => Promise<Result<unknown>>;

/**
 * Untyped Amplify data client. Every response is typed by the interfaces in
 * this file instead: inferring the full `ClientSchema` became "excessively
 * deep" for the compiler once the schema grew, and it slowed every type-check.
 * The operation registry test keeps schema and server in step.
 */
interface DataClient {
  queries: Record<string, AnyOp>;
  mutations: Record<string, AnyOp>;
}
let client: DataClient | undefined;
const api = (): DataClient =>
  (client ??= generateClient({
    authMode: 'userPool',
  }) as unknown as DataClient);

const q = (name: string): AnyOp => {
  const op = api().queries[name];
  if (!op) throw new ApiError('INTERNAL', `Unknown query ${name}`);
  return op;
};
const mu = (name: string): AnyOp => {
  const op = api().mutations[name];
  if (!op) throw new ApiError('INTERNAL', `Unknown mutation ${name}`);
  return op;
};

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
  /** Tenant default currency (ISO 4217) */
  currency?: string | null;
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
  const data = unwrap(await q('me')()) as Me;
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
  return unwrap(await mu('createTenant')({ ...variables })) as {
    tenantId: string;
    farmId: string;
    replayed: boolean;
  };
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
  latestSampleSize?: string | null;
  sizeTendency?: string | null;
  sampleCount?: number | null;
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
  deletedAt?: string | null;
  deleteReason?: string | null;
  /** WHATSAPP_BACKFILL / MANUAL_BACKFILL for history entered later (#101) */
  source?: string | null;
  backfilled?: boolean | null;
  /** Nuts in a past round that couldn't be tied to a tree */
  unattributedQuantity?: number | null;
  excludeFromPrediction?: boolean | null;
  recordCreatedAt?: string | null;
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
  previousQuantity?: number | null;
  source?: string | null;
  backfilled?: boolean | null;
  excludeFromPrediction?: boolean | null;
  deletedAt?: string | null;
  deleteReason?: string | null;
  updatedBy?: string | null;
  version: number;
}

export interface PluckingRoundDetail {
  round: PluckingRound;
  harvests: TreeHarvest[];
  /** Individually removed harvests (restorable, #57) */
  removedHarvests?: TreeHarvest[];
  samples?: CoconutSample[];
}

export const listPluckingRounds = async (
  tenantId: string,
  farmId: string,
  includeDeleted = false
) => [
  ...(unwrap(
    await q('listPluckingRounds')({ tenantId, farmId, includeDeleted })
  ) as PluckingRound[]),
];

export const getPluckingRound = async (tenantId: string, roundId: string) => {
  const d = unwrap(
    await q('getPluckingRound')({ tenantId, roundId })
  ) as PluckingRoundDetail;
  return {
    round: d.round,
    harvests: [...d.harvests],
    removedHarvests: [...(d.removedHarvests ?? [])],
    samples: [...(d.samples ?? [])],
  } satisfies PluckingRoundDetail;
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

// ─── Tree history & planning (#59, #71–#74) ──────────────────────────────────

export interface TreeYieldSummary {
  harvestCount: number;
  lifetimeTotal: number;
  currentYearTotal: number;
  averagePerHarvest?: number | null;
  best?: number | null;
  lastHarvestDate?: string | null;
  lastQuantity?: number | null;
  daysSinceLast?: number | null;
}

export interface PredictionView {
  methodVersion: string;
  confidence: 'NO_PREDICTION' | 'LOW' | 'MEDIUM' | 'HIGH' | string;
  intervalCount: number;
  harvestCount: number;
  lastHarvestDate?: string | null;
  medianIntervalDays?: number | null;
  variability?: number | null;
  highlyInconsistent: boolean;
  estimateDate?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
}

export interface TreeHistory {
  tree: Tree;
  harvests: TreeHarvest[];
  summary: TreeYieldSummary;
  prediction: PredictionView;
  samples: CoconutSample[];
  sizeHistory: SizeHistoryView;
}

export interface DueTree {
  tree: Tree;
  bucket: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'NOT_ENOUGH_HISTORY' | string;
  prediction?: PredictionView | null;
  lastHarvestDate?: string | null;
  lastQuantity?: number | null;
  daysSinceLast?: number | null;
}

export const getTreeHistory = async (
  tenantId: string,
  treeId: string,
  today?: string
) => {
  const h = unwrap(
    await q('getTreeHistory')({ tenantId, treeId, ...(today ? { today } : {}) })
  ) as TreeHistory;
  return { ...h, harvests: [...h.harvests] };
};

export const listDueTrees = async (
  tenantId: string,
  farmId: string,
  today?: string
) => [
  ...(unwrap(
    await q('listDueTrees')({ tenantId, farmId, ...(today ? { today } : {}) })
  ) as DueTree[]),
];

export type { ProduceState, StockByState } from '@/domain/inventory';

export interface ProduceBatch {
  id: string;
  cropCode: string;
  /** Free-text crop name for non-coconut produce (e.g. "Cucumber") */
  cropName?: string | null;
  sourceType: string;
  sourceId?: string | null;
  batchDate: string;
  quantityReceived: number;
  unit: string;
  available: number;
  /** Parsed from AWSJSON; every state of the batch's crop is present */
  availableByState: StockByState;
  status: string;
  version: number;
}

export interface ProduceTxn {
  id: string;
  batchId: string;
  transactionType: string;
  quantity: number;
  unit: string;
  state?: string | null;
  fromState?: string | null;
  toState?: string | null;
  transactionDate: string;
  sourceId?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
}

type RawBatch = Omit<ProduceBatch, 'availableByState'> & {
  availableByState?: string | StockByState | null;
};

/** AWSJSON arrives as a string; normalise to numbers for both states. */
function toBatch(raw: RawBatch): ProduceBatch {
  const parsed =
    typeof raw.availableByState === 'string'
      ? (JSON.parse(raw.availableByState) as StockByState)
      : raw.availableByState;
  // Very old coconut batches had no per-state balance: all husked
  const stored =
    parsed ??
    (raw.cropCode === 'COCONUT'
      ? { HUSKED: raw.available }
      : { FRESH: raw.available });
  return { ...raw, availableByState: stockOf(raw.cropCode, stored) };
}

export const listProduceBatches = async (
  tenantId: string,
  farmId: string,
  availableOnly = true
) =>
  (
    unwrap(
      await q('listProduceBatches')({ tenantId, farmId, availableOnly })
    ) as RawBatch[]
  ).map(toBatch);

export interface ProduceBatchDetail {
  batch: ProduceBatch;
  transactions: ProduceTxn[];
  nextToken: string | null;
}

export const getProduceBatch = async (
  tenantId: string,
  batchId: string,
  nextToken?: string | null
): Promise<ProduceBatchDetail> => {
  const d = unwrap(
    await q('getProduceBatch')({
      tenantId,
      batchId,
      nextToken: nextToken ?? null,
    })
  ) as {
    batch: RawBatch;
    transactions: ProduceTxn[];
    nextToken?: string | null;
  };
  return {
    batch: toBatch(d.batch),
    transactions: [...d.transactions],
    nextToken: d.nextToken ?? null,
  };
};

export interface ProduceMovementResult {
  batch: ProduceBatch;
  transaction: ProduceTxn;
}

const toMovement = (raw: unknown): ProduceMovementResult => {
  const r = raw as { batch: RawBatch; transaction: ProduceTxn };
  return { batch: toBatch(r.batch), transaction: r.transaction };
};

export const recordProduceMovement = async (
  tenantId: string,
  input: {
    batchId: string;
    operationId: string;
    transactionType: string;
    quantity: number;
    state: ProduceState;
    transactionDate: string;
    notes?: string | null;
  }
) =>
  toMovement(unwrap(await mu('recordProduceMovement')({ tenantId, ...input })));

export const dehuskProduce = async (
  tenantId: string,
  input: {
    batchId: string;
    operationId: string;
    quantity: number;
    transactionDate: string;
    notes?: string | null;
  }
) => toMovement(unwrap(await mu('dehuskProduce')({ tenantId, ...input })));

// ─── Dehusked samples (#62–#67) ──────────────────────────────────────────────

export type SizeClass = 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNCLASSIFIED';

export interface CoconutSample {
  id: string;
  harvestId: string;
  roundId?: string | null;
  treeId: string;
  treeCode: string;
  sampledAt: string;
  sizeClass: SizeClass | string;
  weight?: number | null;
  weightUnit?: string | null;
  notes?: string | null;
  version: number;
}

export interface SizeHistoryView {
  latest?: string | null;
  latestDate?: string | null;
  sampleCount: number;
  counts: Record<SizeClass, number>;
  recent: string[];
  tendency?: string | null;
  tendencyMatches: number;
}

export const recordCoconutSample = async (
  tenantId: string,
  input: {
    harvestId: string;
    sampleId: string;
    sizeClass: string;
    weight?: number | null;
    notes?: string | null;
  }
) =>
  unwrap(
    await mu('recordCoconutSample')({ tenantId, ...input })
  ) as CoconutSample;

// ─── Media (#46–#49, ADR-0003) ──────────────────────────────────────────────

export interface Media {
  id: string;
  entityId: string;
  targetType: string;
  entityLabel?: string | null;
  category: string;
  contentType: string;
  byteSize?: number | null;
  capturedAt?: string | null;
  caption?: string | null;
  status: 'PENDING' | 'READY' | 'FAILED' | string;
  thumbUrl?: string | null;
  version: number;
  createdAt?: string | null;
}

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

export interface MediaUploadTarget {
  media: Media;
  /** null when the photo was already uploaded (idempotent retry) */
  upload: { original: PresignedPost; thumb: PresignedPost } | null;
}

export const initiateMediaUpload = async (
  tenantId: string,
  input: {
    mediaId: string;
    entityId: string;
    category?: string | null;
    contentType: string;
    byteSize: number;
    capturedAt?: string | null;
    caption?: string | null;
  }
): Promise<MediaUploadTarget> => {
  const res = unwrap(
    await mu('initiateMediaUpload')({ tenantId, ...input })
  ) as {
    media: Media;
    upload?: string | MediaUploadTarget['upload'];
  };
  const upload =
    typeof res.upload === 'string'
      ? (JSON.parse(res.upload) as MediaUploadTarget['upload'])
      : (res.upload ?? null);
  return { media: res.media, upload };
};

export const completeMediaUpload = async (
  tenantId: string,
  entityId: string,
  mediaId: string
) =>
  unwrap(
    await mu('completeMediaUpload')({ tenantId, entityId, mediaId })
  ) as Media;

export const listMedia = async (tenantId: string, entityId: string) => [
  ...(unwrap(await q('listMedia')({ tenantId, entityId })) as Media[]),
];

export const getMediaOriginalUrl = async (tenantId: string, mediaId: string) =>
  unwrap(await q('getMediaOriginalUrl')({ tenantId, mediaId })) as string;

export const archiveMedia = async (tenantId: string, media: Media) =>
  unwrap(
    await mu('archiveMedia')({
      tenantId,
      entityId: media.entityId,
      mediaId: media.id,
      expectedVersion: media.version,
    })
  ) as Media;

// ─── Corrections & soft delete (#56, #57) ───────────────────────────────────

export const correctTreeHarvest = async (
  tenantId: string,
  harvest: TreeHarvest,
  input: { quantity: number; reason?: string | null }
) =>
  unwrap(
    await mu('correctTreeHarvest')({
      tenantId,
      harvestId: harvest.id,
      expectedVersion: harvest.version,
      quantity: input.quantity,
      reason: input.reason ?? null,
    })
  ) as TreeHarvest;

export const archiveTreeHarvest = async (
  tenantId: string,
  harvest: TreeHarvest,
  reason?: string | null
) =>
  unwrap(
    await mu('archiveTreeHarvest')({
      tenantId,
      harvestId: harvest.id,
      expectedVersion: harvest.version,
      reason: reason ?? null,
    })
  ) as TreeHarvest;

export const restoreTreeHarvest = async (
  tenantId: string,
  harvest: TreeHarvest
) =>
  unwrap(
    await mu('restoreTreeHarvest')({
      tenantId,
      harvestId: harvest.id,
      expectedVersion: harvest.version,
    })
  ) as TreeHarvest;

export const archivePluckingRound = async (
  tenantId: string,
  round: PluckingRound,
  reason?: string | null
) =>
  unwrap(
    await mu('archivePluckingRound')({
      tenantId,
      roundId: round.id,
      expectedVersion: round.version,
      reason: reason ?? null,
    })
  ) as PluckingRound;

export const restorePluckingRound = async (
  tenantId: string,
  round: PluckingRound
) =>
  unwrap(
    await mu('restorePluckingRound')({
      tenantId,
      roundId: round.id,
      expectedVersion: round.version,
    })
  ) as PluckingRound;

// ─── Farm inputs (#80, #81, §12) ────────────────────────────────────────────

export interface InputItem {
  id: string;
  farmId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorderLevel?: number | null;
  lowStock: boolean;
  notes?: string | null;
  status: string;
  version: number;
}

export interface InputTxnView {
  id: string;
  itemId: string;
  transactionType: string;
  quantity: number;
  unit: string;
  transactionDate: string;
  balanceAfter?: number | null;
  reason?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

export const listInputItems = async (
  tenantId: string,
  farmId: string,
  includeArchived = false
) => [
  ...(unwrap(
    await q('listInputItems')({ tenantId, farmId, includeArchived })
  ) as InputItem[]),
];

export const getInputItem = async (
  tenantId: string,
  itemId: string,
  nextToken?: string | null
) => {
  const d = unwrap(
    await q('getInputItem')({ tenantId, itemId, nextToken: nextToken ?? null })
  ) as {
    item: InputItem;
    transactions: InputTxnView[];
    nextToken?: string | null;
  };
  return {
    item: d.item,
    transactions: [...d.transactions],
    nextToken: d.nextToken ?? null,
  };
};

export interface InputItemFields {
  name: string;
  category: string;
  unit: string;
  reorderLevel: number | null;
  notes: string | null;
}

export const createInputItem = async (
  tenantId: string,
  input: InputItemFields & {
    farmId: string;
    itemId: string;
    openingQuantity: number | null;
    openingDate: string;
  }
) => unwrap(await mu('createInputItem')({ tenantId, ...input })) as InputItem;

export const updateInputItem = async (
  tenantId: string,
  item: InputItem,
  changes: Partial<Omit<InputItemFields, 'unit'>> & {
    status?: string;
    clearReorderLevel?: boolean;
  }
) =>
  unwrap(
    await mu('updateInputItem')({
      tenantId,
      itemId: item.id,
      expectedVersion: item.version,
      ...changes,
    })
  ) as InputItem;

export const recordInputMovement = async (
  tenantId: string,
  input: {
    itemId: string;
    operationId: string;
    transactionType: string;
    quantity: number;
    decrease: boolean;
    transactionDate: string;
    reason: string | null;
    notes: string | null;
  }
) =>
  unwrap(await mu('recordInputMovement')({ tenantId, ...input })) as {
    item: InputItem;
    transaction: InputTxnView;
  };

// ─── Buyers (#83, #84) ──────────────────────────────────────────────────────

export interface Buyer {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  preferredSizes: string[];
  acceptableSizes: string[];
  requirementNote?: string | null;
  notes?: string | null;
  status: string;
  version: number;
}

export interface BuyerFields {
  name: string;
  contactName: string;
  phone: string;
  preferredSizes: string[];
  acceptableSizes: string[];
  requirementNote: string;
  notes: string;
}

export const listBuyers = async (tenantId: string, includeArchived = false) => [
  ...(unwrap(await q('listBuyers')({ tenantId, includeArchived })) as Buyer[]),
];

export const getBuyer = async (tenantId: string, buyerId: string) =>
  unwrap(await q('getBuyer')({ tenantId, buyerId })) as Buyer;

export const createBuyer = async (
  tenantId: string,
  buyerId: string,
  f: BuyerFields
) => unwrap(await mu('createBuyer')({ tenantId, buyerId, ...f })) as Buyer;

export const updateBuyer = async (
  tenantId: string,
  buyer: Buyer,
  changes: Partial<BuyerFields> & { status?: string }
) =>
  unwrap(
    await mu('updateBuyer')({
      tenantId,
      buyerId: buyer.id,
      expectedVersion: buyer.version,
      ...changes,
    })
  ) as Buyer;

// ─── Sales (#85–#89) ────────────────────────────────────────────────────────

export interface SaleLine {
  sizeClass?: string | null;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
}

export interface SaleAllocation {
  batchId: string;
  state: ProduceState;
  quantity: number;
}

export interface Sale {
  id: string;
  farmId: string;
  /** COCONUT or a polytunnel crop code (#96) */
  cropCode?: string | null;
  /** NUT, KG, G or COUNT */
  quantityUnit?: string | null;
  saleDate: string;
  buyerId?: string | null;
  buyerName?: string | null;
  lines: SaleLine[];
  allocations: SaleAllocation[];
  totalQuantity: number;
  calculatedAmount: number;
  actualAmountReceived?: number | null;
  difference?: number | null;
  differenceReason?: string | null;
  currency: string;
  notes?: string | null;
  status: string;
  deletedAt?: string | null;
  backfilled?: boolean | null;
  source?: string | null;
  version: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SaleInput {
  buyerId: string | null;
  lines: { sizeClass: string | null; quantity: number; unitPrice: number }[];
  allocations: SaleAllocation[];
  actualAmountReceived: number | null;
  differenceReason: string | null;
  notes: string | null;
}

/** AWSJSON arguments travel as JSON strings. */
const saleVars = (s: SaleInput) => ({
  ...s,
  lines: JSON.stringify(s.lines),
  allocations: JSON.stringify(s.allocations),
});

export const recordSale = async (
  tenantId: string,
  input: SaleInput & { farmId: string; saleId: string; saleDate: string }
) =>
  unwrap(
    await mu('recordSale')({ tenantId, ...input, ...saleVars(input) })
  ) as Sale;

export const updateSale = async (
  tenantId: string,
  sale: Sale,
  input: SaleInput & { reason: string | null }
) =>
  unwrap(
    await mu('updateSale')({
      tenantId,
      saleId: sale.id,
      expectedVersion: sale.version,
      reason: input.reason,
      ...saleVars(input),
    })
  ) as Sale;

export const archiveSale = async (
  tenantId: string,
  sale: Sale,
  reason: string | null
) =>
  unwrap(
    await mu('archiveSale')({
      tenantId,
      saleId: sale.id,
      expectedVersion: sale.version,
      reason,
    })
  ) as Sale;

export const restoreSale = async (tenantId: string, sale: Sale) =>
  unwrap(
    await mu('restoreSale')({
      tenantId,
      saleId: sale.id,
      expectedVersion: sale.version,
    })
  ) as Sale;

export const getSale = async (tenantId: string, saleId: string) =>
  unwrap(await q('getSale')({ tenantId, saleId })) as Sale;

export interface SaleFilters {
  buyerId?: string | null;
  from?: string | null;
  to?: string | null;
  includeDeleted?: boolean;
}

export const listSales = async (
  tenantId: string,
  farmId: string,
  filters: SaleFilters,
  nextToken?: string | null
) => {
  const d = unwrap(
    await q('listSales')({
      tenantId,
      farmId,
      buyerId: filters.buyerId ?? null,
      from: filters.from ?? null,
      to: filters.to ?? null,
      includeDeleted: filters.includeDeleted ?? false,
      nextToken: nextToken ?? null,
    })
  ) as { sales: Sale[]; nextToken?: string | null };
  return { sales: [...d.sales], nextToken: d.nextToken ?? null };
};

// ─── Production cycles & activities (#91–#94) ───────────────────────────────

export interface ProductionCycle {
  id: string;
  farmId: string;
  zoneId: string;
  zoneName?: string | null;
  growingSpaceId?: string | null;
  name: string;
  cropName: string;
  cropCode: string;
  variety?: string | null;
  plantedAt?: string | null;
  expectedEndAt?: string | null;
  endedAt?: string | null;
  estimatedPlantCount?: number | null;
  areaUsed?: number | null;
  areaUnit?: string | null;
  notes?: string | null;
  status: string;
  activityCount?: number | null;
  harvestCount?: number | null;
  lastActivityAt?: string | null;
  lastHarvestAt?: string | null;
  /** AWSJSON running totals per unit, e.g. { KG: 37.5 } */
  harvestTotals?: string | Record<string, number> | null;
  version: number;
}

export interface FarmActivity {
  id: string;
  targetId: string;
  targetType: string;
  activityType: string;
  activityDate: string;
  notes?: string | null;
  quantity?: number | null;
  unit?: string | null;
  materialName?: string | null;
  inputItemId?: string | null;
  version: number;
  createdAt?: string | null;
}

export interface CycleFields {
  name: string;
  cropName: string;
  variety: string | null;
  zoneId: string;
  growingSpaceId: string | null;
  plantedAt: string | null;
  expectedEndAt: string | null;
  estimatedPlantCount: number | null;
  areaUsed: number | null;
  areaUnit: string | null;
  notes: string | null;
}

export const listCycles = async (
  tenantId: string,
  farmId: string,
  includeClosed = false
) => [
  ...(unwrap(
    await q('listCycles')({ tenantId, farmId, includeClosed })
  ) as ProductionCycle[]),
];

export const getCycle = async (tenantId: string, cycleId: string) => {
  const d = unwrap(await q('getCycle')({ tenantId, cycleId })) as {
    cycle: ProductionCycle;
    activities: FarmActivity[];
    harvests?: CycleHarvest[];
  };
  return {
    cycle: d.cycle,
    activities: [...d.activities],
    harvests: [...(d.harvests ?? [])],
  };
};

export const createCycle = async (
  tenantId: string,
  input: CycleFields & { farmId: string; cycleId: string; status: string }
) => unwrap(await mu('createCycle')({ tenantId, ...input })) as ProductionCycle;

export const updateCycle = async (
  tenantId: string,
  cycle: ProductionCycle,
  changes: Partial<CycleFields> & { status?: string; statusDate?: string }
) =>
  unwrap(
    await mu('updateCycle')({
      tenantId,
      cycleId: cycle.id,
      expectedVersion: cycle.version,
      ...changes,
    })
  ) as ProductionCycle;

export interface ActivityInput {
  activityId: string;
  targetId: string;
  activityType: string;
  activityDate: string;
  notes: string | null;
  quantity: number | null;
  unit: string | null;
  materialName: string | null;
  inputItemId: string | null;
}

export const recordActivity = async (tenantId: string, input: ActivityInput) =>
  unwrap(await mu('recordActivity')({ tenantId, ...input })) as FarmActivity;

export const archiveActivity = async (tenantId: string, a: FarmActivity) =>
  unwrap(
    await mu('archiveActivity')({
      tenantId,
      activityId: a.id,
      expectedVersion: a.version,
    })
  ) as FarmActivity;

// ─── Polytunnel harvests (#95) ──────────────────────────────────────────────

export interface CycleHarvest {
  id: string;
  productionCycleId: string;
  cropCode: string;
  cropName?: string | null;
  harvestDate: string;
  quantity: number;
  unit: string;
  qualityNote?: string | null;
  notes?: string | null;
  batchId: string;
  version: number;
}

export const recordCycleHarvest = async (
  tenantId: string,
  input: {
    cycleId: string;
    harvestId: string;
    harvestDate: string;
    quantity: number;
    unit: string;
    qualityNote: string | null;
    notes: string | null;
  }
) =>
  unwrap(
    await mu('recordCycleHarvest')({ tenantId, ...input })
  ) as CycleHarvest;

// ─── Team access (#121, #37) ────────────────────────────────────────────────

export interface TeamMember {
  userId: string;
  email?: string | null;
  profileId: string;
  profileName?: string | null;
  status: string;
  isMe: boolean;
  version: number;
  joinedAt?: string | null;
}

export interface TeamInvite {
  email: string;
  profileId: string;
  profileName?: string | null;
  expiresAt: string;
  invitedBy?: string | null;
}

export interface TeamRole {
  id: string;
  name: string;
  entitlements: string[];
  isSystem: boolean;
  status: string;
  version: number;
}

export interface TeamProfile {
  id: string;
  name: string;
  roleIds: string[];
  isSystem: boolean;
  status: string;
  version: number;
}

export interface Team {
  members: TeamMember[];
  invites: TeamInvite[];
  roles: TeamRole[];
  profiles: TeamProfile[];
  catalogue: string[];
  myEntitlements: string[];
}

export interface MyInvite {
  tenantId: string;
  tenantName: string;
  invitedBy?: string | null;
  expiresAt: string;
}

export const getTeam = async (tenantId: string) => {
  const d = unwrap(await q('getTeam')({ tenantId })) as Team;
  return {
    members: [...d.members],
    invites: [...d.invites],
    roles: [...d.roles],
    profiles: [...d.profiles],
    catalogue: [...d.catalogue],
    myEntitlements: [...d.myEntitlements],
  } satisfies Team;
};

export const myInvites = async () => [
  ...(unwrap(await q('myInvites')({})) as MyInvite[]),
];

export const inviteMember = async (
  tenantId: string,
  email: string,
  profileId: string
) =>
  unwrap(
    await mu('inviteMember')({ tenantId, email, profileId })
  ) as TeamInvite;

export const revokeInvite = async (tenantId: string, email: string) =>
  unwrap(await mu('revokeInvite')({ tenantId, email })) as boolean;

export const acceptInvite = async (tenantId: string) =>
  unwrap(await mu('acceptInvite')({ tenantId })) as {
    tenantId: string;
    joined: boolean;
  };

export const updateMember = async (
  tenantId: string,
  member: TeamMember,
  changes: { profileId?: string; status?: string }
) =>
  unwrap(
    await mu('updateMember')({
      tenantId,
      userId: member.userId,
      expectedVersion: member.version,
      ...changes,
    })
  ) as { userId: string; profileId: string; status: string; version: number };

export const saveRole = async (
  tenantId: string,
  role: { id: string; version: number },
  values: { name: string; entitlements: string[]; status?: string }
) =>
  unwrap(
    await mu('saveRole')({
      tenantId,
      roleId: role.id,
      expectedVersion: role.version,
      ...values,
    })
  ) as TeamRole;

export const saveProfile = async (
  tenantId: string,
  profile: { id: string; version: number },
  values: { name: string; roleIds: string[]; status?: string }
) =>
  unwrap(
    await mu('saveProfile')({
      tenantId,
      profileId: profile.id,
      expectedVersion: profile.version,
      ...values,
    })
  ) as TeamProfile;

// ─── Historical backfill (#101) ─────────────────────────────────────────────

export type BackfillSource = 'WHATSAPP_BACKFILL' | 'MANUAL_BACKFILL';

export interface BackfillRoundInput {
  roundId: string;
  roundDate: string;
  source: BackfillSource;
  entries: {
    treeId: string;
    harvestId: string;
    quantity: number;
    approximate: boolean;
  }[];
  unattributedQuantity: number | null;
  approximate: boolean;
  excludeFromPrediction: boolean;
  addToStock: boolean;
  notes: string | null;
}

export const backfillRound = async (
  tenantId: string,
  farmId: string,
  input: BackfillRoundInput
) =>
  unwrap(
    await mu('backfillRound')({
      tenantId,
      farmId,
      ...input,
      entries: JSON.stringify(input.entries),
    })
  ) as PluckingRound;

export const backfillSale = async (
  tenantId: string,
  input: Omit<SaleInput, 'allocations'> & {
    farmId: string;
    saleId: string;
    saleDate: string;
    source: BackfillSource;
  }
) =>
  unwrap(
    await mu('backfillSale')({
      tenantId,
      ...input,
      lines: JSON.stringify(input.lines),
    })
  ) as Sale;

export const setHarvestPredictionUse = async (
  tenantId: string,
  harvest: TreeHarvest,
  exclude: boolean
) =>
  unwrap(
    await mu('setHarvestPredictionUse')({
      tenantId,
      harvestId: harvest.id,
      expectedVersion: harvest.version,
      excludeFromPrediction: exclude,
    })
  ) as TreeHarvest;

// ─── Analytics (#99, #100) ──────────────────────────────────────────────────

export interface AnalyticsReport {
  period: { from: string; to: string };
  generatedAt: string;
  includeNonProducing: boolean;
  coconut: {
    totals: {
      nuts: number;
      harvestRecords: number;
      avgPerHarvest: number | null;
      producingTrees: number;
      trees: number;
    };
    byMonth: { month: string; value: number; count: number }[];
    rounds: ReturnType<typeof import('@/domain/analytics').roundStats>;
    samples: ReturnType<typeof import('@/domain/analytics').sampleDistribution>;
    trees: (import('@/domain/analytics').TreeStats & {
      nextEstimate: string | null;
    })[];
    insights: import('@/domain/analytics').Insight[];
  };
  sales: import('@/domain/analytics').SalesSummary;
  stock: {
    current: {
      cropCode: string;
      cropName: string;
      unit: string;
      byState: StockByState;
      total: number;
    }[];
    adjustments: ReturnType<
      typeof import('@/domain/analytics').stockAdjustments
    >;
    inputs: number;
    lowStock: {
      id: string;
      name: string;
      quantity: number;
      unit: string;
      reorderLevel?: number | null;
    }[];
  };
  crops: ReturnType<typeof import('@/domain/analytics').cropHarvests>;
}

export const getAnalytics = async (
  tenantId: string,
  farmId: string,
  period: { from: string; to: string },
  includeNonProducing = false
): Promise<AnalyticsReport> => {
  const raw = unwrap(
    await q('getAnalytics')({
      tenantId,
      farmId,
      ...period,
      includeNonProducing,
    })
  ) as string | AnalyticsReport;
  return typeof raw === 'string' ? (JSON.parse(raw) as AnalyticsReport) : raw;
};
