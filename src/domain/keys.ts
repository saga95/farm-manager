/**
 * DynamoDB key builders for the single `FarmData` table (ADR-0002).
 *
 * The ONLY place key strings are constructed. Every partition key starts with
 * `T#<tenantId>`, so handlers that build keys from the authorized tenant can
 * never address another tenant's data.
 */

const SEP = '#';
const assertId = (label: string, id: string): string => {
  if (!id || id.includes(SEP))
    throw new Error(`Invalid ${label}: ${JSON.stringify(id)}`);
  return id;
};

const t = (tenantId: string) => `T${SEP}${assertId('tenantId', tenantId)}`;

export interface Key {
  PK: string;
  SK: string;
}

/** GSI1 partition holding a user's memberships. */
const userPk = (userId: string): string =>
  `U${SEP}${assertId('userId', userId)}`;

export const keys: KeyBuilders = {
  tenant: (tenantId: string): Key => ({ PK: t(tenantId), SK: 'TENANT' }),

  member: (tenantId: string, userId: string): Key => ({
    PK: t(tenantId),
    SK: `MEMBER${SEP}${assertId('userId', userId)}`,
  }),
  /** GSI1: tenants of a user (only ever queried with the caller's own sub). */
  memberByUser: (userId: string, tenantId: string) => ({
    GSI1PK: userPk(userId),
    GSI1SK: t(tenantId),
  }),
  userPk,

  role: (tenantId: string, roleId: string): Key => ({
    PK: t(tenantId),
    SK: `ROLE${SEP}${assertId('roleId', roleId)}`,
  }),
  profile: (tenantId: string, profileId: string): Key => ({
    PK: t(tenantId),
    SK: `PROFILE${SEP}${assertId('profileId', profileId)}`,
  }),

  farm: (tenantId: string, farmId: string): Key => ({
    PK: t(tenantId),
    SK: `FARM${SEP}${assertId('farmId', farmId)}`,
  }),

  /** Partition holding a farm's zones, spaces, trees, rounds, cycles… (ADR-0002). */
  farmPk: (tenantId: string, farmId: string): string =>
    `${t(tenantId)}${SEP}F${SEP}${assertId('farmId', farmId)}`,

  zone: (tenantId: string, farmId: string, zoneId: string): Key => ({
    PK: keys.farmPk(tenantId, farmId),
    SK: `ZONE${SEP}${assertId('zoneId', zoneId)}`,
  }),

  space: (tenantId: string, farmId: string, spaceId: string): Key => ({
    PK: keys.farmPk(tenantId, farmId),
    SK: `SPACE${SEP}${assertId('spaceId', spaceId)}`,
  }),

  /** Coconut tree, keyed by its unique-per-farm code (FR-CN-004). */
  tree: (tenantId: string, farmId: string, code: string): Key => ({
    PK: keys.farmPk(tenantId, farmId),
    SK: `TREE${SEP}${assertId('code', code)}`,
  }),
  /** GSI1: trees by farm + status (ADR-0002). */
  treeByStatus: (
    tenantId: string,
    farmId: string,
    status: string,
    code: string
  ) => ({
    GSI1PK: `${keys.farmPk(tenantId, farmId)}${SEP}TS${SEP}${assertId('status', status)}`,
    GSI1SK: `TREE${SEP}${assertId('code', code)}`,
  }),

  /** Plucking round within a farm, sorted by date (ADR-0002). */
  round: (
    tenantId: string,
    farmId: string,
    roundDate: string,
    roundId: string
  ): Key => ({
    PK: keys.farmPk(tenantId, farmId),
    SK: `ROUND${SEP}${assertId('roundDate', roundDate)}${SEP}${assertId('roundId', roundId)}`,
  }),
  /** Partition for a round's per-tree slots (one tree once per round, §8.2). */
  roundPk: (tenantId: string, roundId: string): string =>
    `${t(tenantId)}${SEP}R${SEP}${assertId('roundId', roundId)}`,
  roundSlot: (tenantId: string, roundId: string, treeId: string): Key => ({
    PK: keys.roundPk(tenantId, roundId),
    SK: `SLOT${SEP}${assertId('treeId', treeId)}`,
  }),
  /** A tree's harvest timeline partition. */
  treePk: (tenantId: string, treeId: string): string =>
    `${t(tenantId)}${SEP}TREE${SEP}${assertId('treeId', treeId)}`,
  harvest: (
    tenantId: string,
    treeId: string,
    harvestDate: string,
    harvestId: string
  ): Key => ({
    PK: keys.treePk(tenantId, treeId),
    SK: `H${SEP}${assertId('harvestDate', harvestDate)}${SEP}${assertId('harvestId', harvestId)}`,
  }),
  /** GSI1: harvests in a round, by tree code. */
  harvestByRound: (tenantId: string, roundId: string, treeCode: string) => ({
    GSI1PK: keys.roundPk(tenantId, roundId),
    GSI1SK: `H${SEP}${assertId('treeCode', treeCode)}`,
  }),

  /** Produce batch within a farm (ADR-0002, SRS §11.2). */
  produceBatch: (
    tenantId: string,
    farmId: string,
    cropCode: string,
    batchDate: string,
    batchId: string
  ): Key => ({
    PK: keys.farmPk(tenantId, farmId),
    SK: `BATCH${SEP}${assertId('cropCode', cropCode)}${SEP}${assertId('batchDate', batchDate)}${SEP}${assertId('batchId', batchId)}`,
  }),
  /** Produce inventory transaction; txnId is deterministic per cause (ADR-0004). */
  produceTxn: (
    tenantId: string,
    batchId: string,
    txnDate: string,
    txnId: string
  ): Key => ({
    PK: `${t(tenantId)}${SEP}B${SEP}${assertId('batchId', batchId)}`,
    SK: `TX${SEP}${assertId('txnDate', txnDate)}${SEP}${txnId}`,
  }),

  /** Dehusked sample: ONE per tree harvest, keyed by the harvest (§9.2). */
  sample: (
    tenantId: string,
    treeId: string,
    harvestDate: string,
    harvestId: string
  ): Key => ({
    PK: keys.treePk(tenantId, treeId),
    SK: `S${SEP}${assertId('harvestDate', harvestDate)}${SEP}${assertId('harvestId', harvestId)}`,
  }),

  /** Farm-input item (§12) within a farm. */
  inputItem: (tenantId: string, farmId: string, itemId: string): Key => ({
    PK: keys.farmPk(tenantId, farmId),
    SK: `INPUT${SEP}${assertId('itemId', itemId)}`,
  }),
  /** Farm-input transaction; txnId is deterministic per operation (ADR-0004). */
  inputTxnPk: (tenantId: string, itemId: string): string =>
    `${t(tenantId)}${SEP}I${SEP}${assertId('itemId', itemId)}`,
  inputTxn: (
    tenantId: string,
    itemId: string,
    txnDate: string,
    txnId: string
  ): Key => ({
    PK: keys.inputTxnPk(tenantId, itemId),
    SK: `TX${SEP}${assertId('txnDate', txnDate)}${SEP}${txnId}`,
  }),

  /** Photos attached to one entity, oldest first (ULID order) (ADR-0003). */
  mediaPk: (tenantId: string, entityId: string): string =>
    `${t(tenantId)}${SEP}M${SEP}${assertId('entityId', entityId)}`,
  media: (tenantId: string, entityId: string, mediaId: string): Key => ({
    PK: keys.mediaPk(tenantId, entityId),
    SK: `MEDIA${SEP}${assertId('mediaId', mediaId)}`,
  }),

  /** GSI2: get any entity by id; results MUST be tenant-checked. */
  byId: (id: string) => ({ GSI2PK: `ID${SEP}${assertId('id', id)}` }),

  audit: (
    tenantId: string,
    entityId: string,
    at: string,
    auditId: string
  ): Key => ({
    PK: `${t(tenantId)}${SEP}AUD${SEP}${assertId('entityId', entityId)}`,
    SK: `${at}${SEP}${assertId('auditId', auditId)}`,
  }),

  prefix: {
    members: 'MEMBER#',
    roles: 'ROLE#',
    profiles: 'PROFILE#',
    farms: 'FARM#',
    zones: 'ZONE#',
    spaces: 'SPACE#',
    trees: 'TREE#',
    rounds: 'ROUND#',
    batches: 'BATCH#',
    media: 'MEDIA#',
    inputs: 'INPUT#',
  },
  tenantPk: t,
};

interface KeyBuilders {
  tenant: (tenantId: string) => Key;
  member: (tenantId: string, userId: string) => Key;
  memberByUser: (
    userId: string,
    tenantId: string
  ) => { GSI1PK: string; GSI1SK: string };
  userPk: (userId: string) => string;
  role: (tenantId: string, roleId: string) => Key;
  profile: (tenantId: string, profileId: string) => Key;
  farm: (tenantId: string, farmId: string) => Key;
  farmPk: (tenantId: string, farmId: string) => string;
  zone: (tenantId: string, farmId: string, zoneId: string) => Key;
  space: (tenantId: string, farmId: string, spaceId: string) => Key;
  tree: (tenantId: string, farmId: string, code: string) => Key;
  treeByStatus: (
    tenantId: string,
    farmId: string,
    status: string,
    code: string
  ) => { GSI1PK: string; GSI1SK: string };
  round: (
    tenantId: string,
    farmId: string,
    roundDate: string,
    roundId: string
  ) => Key;
  roundPk: (tenantId: string, roundId: string) => string;
  roundSlot: (tenantId: string, roundId: string, treeId: string) => Key;
  treePk: (tenantId: string, treeId: string) => string;
  harvest: (
    tenantId: string,
    treeId: string,
    harvestDate: string,
    harvestId: string
  ) => Key;
  harvestByRound: (
    tenantId: string,
    roundId: string,
    treeCode: string
  ) => { GSI1PK: string; GSI1SK: string };
  produceBatch: (
    tenantId: string,
    farmId: string,
    cropCode: string,
    batchDate: string,
    batchId: string
  ) => Key;
  produceTxn: (
    tenantId: string,
    batchId: string,
    txnDate: string,
    txnId: string
  ) => Key;
  sample: (
    tenantId: string,
    treeId: string,
    harvestDate: string,
    harvestId: string
  ) => Key;
  inputItem: (tenantId: string, farmId: string, itemId: string) => Key;
  inputTxnPk: (tenantId: string, itemId: string) => string;
  inputTxn: (
    tenantId: string,
    itemId: string,
    txnDate: string,
    txnId: string
  ) => Key;
  mediaPk: (tenantId: string, entityId: string) => string;
  media: (tenantId: string, entityId: string, mediaId: string) => Key;
  byId: (id: string) => { GSI2PK: string };
  audit: (
    tenantId: string,
    entityId: string,
    at: string,
    auditId: string
  ) => Key;
  prefix: Readonly<
    Record<
      | 'members'
      | 'roles'
      | 'profiles'
      | 'farms'
      | 'zones'
      | 'spaces'
      | 'trees'
      | 'rounds'
      | 'batches'
      | 'media'
      | 'inputs',
      string
    >
  >;
  tenantPk: (tenantId: string) => string;
}

/** ULID: 26 Crockford base32 characters (ADR-0004 client-generated ids). */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const isUlid = (value: string): boolean => ULID_PATTERN.test(value);
