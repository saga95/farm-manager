import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { farmApi } from '../functions/farm-api/resource';

/**
 * Farm Manager API (ADR-0001, ADR-0002).
 *
 * Business data is NOT exposed as Amplify models. Every field is a custom
 * operation backed by the `farm-api` Lambda, which authorizes the caller
 * against tenant-scoped RBAC and reads/writes the single `FarmData` table.
 * Cognito user pool is the only auth mode (no public API key).
 */
/** Optional growing-space fields shared by create/update (§41.2). */
const spaceArgs = {
  tenantId: a.id().required(),
  farmId: a.id().required(),
  parentZoneId: a.id(),
  width: a.float(),
  length: a.float(),
  lengthUnit: a.string(),
  sunlightLevel: a.string(),
  shadeLevel: a.string(),
  waterAccess: a.string(),
  drainage: a.string(),
  slope: a.string(),
  surfaceType: a.string(),
  currentUse: a.string(),
  notes: a.string(),
};

/** Optional tree fields shared by create/update (§7.1). */
const treeArgs = {
  tenantId: a.id().required(),
  farmId: a.id().required(),
  displayLabel: a.string(),
  zoneId: a.id(),
  variety: a.string(),
  plantedAt: a.string(),
  locationNote: a.string(),
  notes: a.string(),
};

const schema = a.schema({
  TenantMembership: a.customType({
    tenantId: a.id().required(),
    tenantName: a.string().required(),
    currency: a.string(),
    profileId: a.string().required(),
    profileName: a.string().required(),
    entitlements: a.string().required().array().required(),
  }),

  Me: a.customType({
    userId: a.id().required(),
    email: a.string(),
    memberships: a.ref('TenantMembership').required().array().required(),
  }),

  Farm: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    name: a.string().required(),
    description: a.string(),
    area: a.float(),
    areaUnit: a.string(),
    locationLabel: a.string(),
    timezone: a.string(),
    status: a.string().required(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  Zone: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    name: a.string().required(),
    zoneType: a.string().required(),
    description: a.string(),
    area: a.float(),
    areaUnit: a.string(),
    status: a.string().required(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  GrowingSpace: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    parentZoneId: a.id(),
    name: a.string().required(),
    spaceType: a.string().required(),
    width: a.float(),
    length: a.float(),
    lengthUnit: a.string(),
    calculatedAreaSqM: a.float(),
    sunlightLevel: a.string(),
    shadeLevel: a.string(),
    waterAccess: a.string(),
    drainage: a.string(),
    slope: a.string(),
    surfaceType: a.string(),
    currentUse: a.string(),
    notes: a.string(),
    status: a.string().required(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  Tree: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    code: a.string().required(),
    displayLabel: a.string(),
    cropCode: a.string().required(),
    zoneId: a.id(),
    status: a.string().required(),
    variety: a.string(),
    plantedAt: a.string(),
    locationNote: a.string(),
    notes: a.string(),
    coverPhotoId: a.id(),
    lastHarvestDate: a.string(),
    lastQuantity: a.integer(),
    harvestCount: a.integer(),
    latestSampleSize: a.string(),
    sizeTendency: a.string(),
    sampleCount: a.integer(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  TreeRef: a.customType({
    id: a.id().required(),
    code: a.string().required(),
  }),

  BulkCreateTreesResult: a.customType({
    created: a.ref('TreeRef').required().array().required(),
    skipped: a.string().required().array().required(),
  }),

  PluckingRound: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    roundDate: a.string().required(),
    plannedTreeIds: a.id().required().array().required(),
    skippedTreeIds: a.id().required().array().required(),
    status: a.string().required(),
    pluckerName: a.string(),
    notes: a.string(),
    totalNuts: a.integer(),
    batchId: a.id(),
    completedAt: a.string(),
    deletedAt: a.string(),
    deleteReason: a.string(),
    source: a.string(),
    backfilled: a.boolean(),
    unattributedQuantity: a.integer(),
    recordQuality: a.string(),
    excludeFromPrediction: a.boolean(),
    recordCreatedAt: a.string(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  TreeHarvest: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    roundId: a.id(),
    treeId: a.id().required(),
    treeCode: a.string().required(),
    harvestDate: a.string().required(),
    quantity: a.integer(),
    quantityUnit: a.string().required(),
    recordQuality: a.string().required(),
    excludeFromPrediction: a.boolean().required(),
    notes: a.string(),
    photoIds: a.id().required().array(),
    source: a.string().required(),
    previousQuantity: a.integer(),
    backfilled: a.boolean(),
    recordCreatedAt: a.string(),
    deletedAt: a.string(),
    deleteReason: a.string(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
    updatedBy: a.string(),
  }),

  PluckingRoundDetail: a.customType({
    round: a.ref('PluckingRound').required(),
    harvests: a.ref('TreeHarvest').required().array().required(),
    removedHarvests: a.ref('TreeHarvest').required().array().required(),
    samples: a.ref('CoconutSample').required().array().required(),
  }),

  CoconutSample: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    harvestId: a.id().required(),
    roundId: a.id(),
    treeId: a.id().required(),
    treeCode: a.string().required(),
    sampledAt: a.string().required(),
    sampleCount: a.integer().required(),
    sizeClass: a.string().required(),
    weight: a.float(),
    weightUnit: a.string(),
    diameter: a.float(),
    circumference: a.float(),
    measurementUnit: a.string(),
    notes: a.string(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  Media: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    entityId: a.id().required(),
    targetType: a.string().required(),
    entityLabel: a.string(),
    category: a.string().required(),
    contentType: a.string().required(),
    byteSize: a.integer(),
    capturedAt: a.string(),
    caption: a.string(),
    status: a.string().required(),
    thumbUrl: a.string(),
    version: a.integer().required(),
    createdAt: a.string(),
    createdBy: a.string(),
  }),

  MediaUpload: a.customType({
    media: a.ref('Media').required(),
    /** JSON { original: {url, fields}, thumb: {url, fields} }; null when already uploaded */
    upload: a.json(),
  }),

  SizeCounts: a.customType({
    SMALL: a.integer().required(),
    MEDIUM: a.integer().required(),
    LARGE: a.integer().required(),
    UNCLASSIFIED: a.integer().required(),
  }),

  SizeHistory: a.customType({
    latest: a.string(),
    latestDate: a.string(),
    sampleCount: a.integer().required(),
    counts: a.ref('SizeCounts').required(),
    recent: a.string().required().array().required(),
    tendency: a.string(),
    tendencyMatches: a.integer().required(),
  }),

  TreeYieldSummary: a.customType({
    harvestCount: a.integer().required(),
    lifetimeTotal: a.integer().required(),
    currentYearTotal: a.integer().required(),
    averagePerHarvest: a.float(),
    best: a.integer(),
    lastHarvestDate: a.string(),
    lastQuantity: a.integer(),
    daysSinceLast: a.integer(),
  }),

  Prediction: a.customType({
    methodVersion: a.string().required(),
    confidence: a.string().required(),
    intervalCount: a.integer().required(),
    harvestCount: a.integer().required(),
    lastHarvestDate: a.string(),
    medianIntervalDays: a.float(),
    variability: a.float(),
    highlyInconsistent: a.boolean().required(),
    estimateDate: a.string(),
    windowStart: a.string(),
    windowEnd: a.string(),
  }),

  TreeHistory: a.customType({
    tree: a.ref('Tree').required(),
    harvests: a.ref('TreeHarvest').required().array().required(),
    summary: a.ref('TreeYieldSummary').required(),
    prediction: a.ref('Prediction').required(),
    samples: a.ref('CoconutSample').required().array().required(),
    sizeHistory: a.ref('SizeHistory').required(),
  }),

  DueTree: a.customType({
    tree: a.ref('Tree').required(),
    bucket: a.string().required(),
    prediction: a.ref('Prediction'),
    lastHarvestDate: a.string(),
    lastQuantity: a.integer(),
    daysSinceLast: a.integer(),
    latestSampleSize: a.string(),
    sizeTendency: a.string(),
  }),

  CreateTenantResult: a.customType({
    tenantId: a.id().required(),
    farmId: a.id().required(),
    replayed: a.boolean().required(),
  }),

  /** The caller and their tenant memberships with resolved entitlements. */
  me: a
    .query()
    .returns(a.ref('Me').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  /** SCR-002: create a tenant, its default roles/profiles, the caller as Owner and the first farm. */
  createTenant: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      name: a.string().required(),
      defaultTimezone: a.string().required(),
      defaultCurrency: a.string().required(),
      defaultLocale: a.string().required(),
      farmId: a.id().required(),
      farmName: a.string().required(),
      farmArea: a.float(),
      farmAreaUnit: a.string(),
      farmLocationLabel: a.string(),
    })
    .returns(a.ref('CreateTenantResult').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Farms, zones, growing spaces (#33–#36) ───────────────────────────────
  listFarms: a
    .query()
    .arguments({ tenantId: a.id().required(), includeArchived: a.boolean() })
    .returns(a.ref('Farm').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateFarm: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      expectedVersion: a.integer().required(),
      name: a.string(),
      description: a.string(),
      area: a.float(),
      areaUnit: a.string(),
      locationLabel: a.string(),
      status: a.string(),
    })
    .returns(a.ref('Farm').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listZones: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      includeArchived: a.boolean(),
    })
    .returns(a.ref('Zone').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  createZone: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      zoneId: a.id().required(),
      name: a.string().required(),
      zoneType: a.string().required(),
      description: a.string(),
      area: a.float(),
      areaUnit: a.string(),
    })
    .returns(a.ref('Zone').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateZone: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      zoneId: a.id().required(),
      expectedVersion: a.integer().required(),
      name: a.string(),
      zoneType: a.string(),
      description: a.string(),
      area: a.float(),
      areaUnit: a.string(),
      status: a.string(),
    })
    .returns(a.ref('Zone').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listSpaces: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      status: a.string(),
      includeArchived: a.boolean(),
    })
    .returns(a.ref('GrowingSpace').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  createSpace: a
    .mutation()
    .arguments({
      ...spaceArgs,
      spaceId: a.id().required(),
      name: a.string().required(),
      spaceType: a.string().required(),
    })
    .returns(a.ref('GrowingSpace').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateSpace: a
    .mutation()
    .arguments({
      ...spaceArgs,
      spaceId: a.id().required(),
      expectedVersion: a.integer().required(),
      name: a.string(),
      spaceType: a.string(),
      status: a.string(),
    })
    .returns(a.ref('GrowingSpace').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Coconut tree registry (#40–#45) ──────────────────────────────────────
  listTrees: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      includeInactive: a.boolean(),
    })
    .returns(a.ref('Tree').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getTree: a
    .query()
    .arguments({ tenantId: a.id().required(), treeId: a.id().required() })
    .returns(a.ref('Tree').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  createTree: a
    .mutation()
    .arguments({
      ...treeArgs,
      treeId: a.id().required(),
      code: a.string().required(),
      status: a.string().required(),
    })
    .returns(a.ref('Tree').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateTree: a
    .mutation()
    .arguments({
      ...treeArgs,
      code: a.string().required(),
      expectedVersion: a.integer().required(),
      status: a.string(),
    })
    .returns(a.ref('Tree').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  bulkCreateTrees: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      prefix: a.string(),
      start: a.integer().required(),
      count: a.integer().required(),
      width: a.integer(),
      status: a.string().required(),
      zoneId: a.id(),
    })
    .returns(a.ref('BulkCreateTreesResult').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Plucking rounds (#51–#54) ────────────────────────────────────────────
  createPluckingRound: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      roundId: a.id().required(),
      roundDate: a.string().required(),
      plannedTreeIds: a.id().required().array().required(),
      pluckerName: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('PluckingRound').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listPluckingRounds: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      limit: a.integer(),
      includeDeleted: a.boolean(),
    })
    .returns(a.ref('PluckingRound').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getPluckingRound: a
    .query()
    .arguments({ tenantId: a.id().required(), roundId: a.id().required() })
    .returns(a.ref('PluckingRoundDetail').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateRoundPlan: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      roundId: a.id().required(),
      expectedVersion: a.integer().required(),
      addTreeIds: a.id().required().array(),
      removeTreeIds: a.id().required().array(),
      skipTreeIds: a.id().required().array(),
      unskipTreeIds: a.id().required().array(),
      pluckerName: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('PluckingRound').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  recordTreeHarvest: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      roundId: a.id().required(),
      treeId: a.id().required(),
      harvestId: a.id().required(),
      quantity: a.integer().required(),
      recordQuality: a.string(),
      notes: a.string(),
      excludeFromPrediction: a.boolean(),
    })
    .returns(a.ref('TreeHarvest').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  completePluckingRound: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      roundId: a.id().required(),
      expectedVersion: a.integer().required(),
    })
    .returns(a.ref('PluckingRound').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Tree history & planning (#59, #71–#74) ───────────────────────────────
  getTreeHistory: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      treeId: a.id().required(),
      today: a.string(),
    })
    .returns(a.ref('TreeHistory').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listDueTrees: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      today: a.string(),
    })
    .returns(a.ref('DueTree').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Dehusked samples (#62–#67) ───────────────────────────────────────────
  recordCoconutSample: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      harvestId: a.id().required(),
      sampleId: a.id().required(),
      sizeClass: a.string().required(),
      weight: a.float(),
      weightUnit: a.string(),
      diameter: a.float(),
      circumference: a.float(),
      measurementUnit: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('CoconutSample').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Historical backfill (#101, §18, §41.13) ──────────────────────────────
  backfillRound: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      roundId: a.id().required(),
      roundDate: a.string().required(),
      source: a.string().required(),
      entries: a.json().required(),
      unattributedQuantity: a.integer(),
      approximate: a.boolean(),
      excludeFromPrediction: a.boolean(),
      addToStock: a.boolean(),
      pluckerName: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('PluckingRound').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  setHarvestPredictionUse: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      harvestId: a.id().required(),
      expectedVersion: a.integer().required(),
      excludeFromPrediction: a.boolean().required(),
    })
    .returns(a.ref('TreeHarvest').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Corrections & soft delete (#56, #57, §31) ───────────────────────────
  correctTreeHarvest: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      harvestId: a.id().required(),
      expectedVersion: a.integer().required(),
      quantity: a.integer().required(),
      recordQuality: a.string(),
      notes: a.string(),
      reason: a.string(),
    })
    .returns(a.ref('TreeHarvest').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  archiveTreeHarvest: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      harvestId: a.id().required(),
      expectedVersion: a.integer().required(),
      reason: a.string(),
    })
    .returns(a.ref('TreeHarvest').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  restoreTreeHarvest: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      harvestId: a.id().required(),
      expectedVersion: a.integer().required(),
      reason: a.string(),
    })
    .returns(a.ref('TreeHarvest').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  archivePluckingRound: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      roundId: a.id().required(),
      expectedVersion: a.integer().required(),
      reason: a.string(),
    })
    .returns(a.ref('PluckingRound').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  restorePluckingRound: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      roundId: a.id().required(),
      expectedVersion: a.integer().required(),
      reason: a.string(),
    })
    .returns(a.ref('PluckingRound').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Media (#46–#48, ADR-0003) ────────────────────────────────────────────
  initiateMediaUpload: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      mediaId: a.id().required(),
      entityId: a.id().required(),
      category: a.string(),
      contentType: a.string().required(),
      byteSize: a.integer().required(),
      capturedAt: a.string(),
      caption: a.string(),
    })
    .returns(a.ref('MediaUpload').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  completeMediaUpload: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      entityId: a.id().required(),
      mediaId: a.id().required(),
    })
    .returns(a.ref('Media').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listMedia: a
    .query()
    .arguments({ tenantId: a.id().required(), entityId: a.id().required() })
    .returns(a.ref('Media').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getMediaOriginalUrl: a
    .query()
    .arguments({ tenantId: a.id().required(), mediaId: a.id().required() })
    .returns(a.string().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  archiveMedia: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      entityId: a.id().required(),
      mediaId: a.id().required(),
      expectedVersion: a.integer().required(),
    })
    .returns(a.ref('Media').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),
});

/**
 * Stock bounded context: produce inventory (§11) and farm inputs (§12).
 * A separate `a.schema` combined below: one schema per bounded context keeps
 * Amplify's type inference under TypeScript's instantiation-depth limit
 * (TS2589 appeared once everything lived in a single schema). Types here may
 * only `a.ref` types defined in this same schema.
 */
const stock = a.schema({
  ProduceBatch: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    cropCode: a.string().required(),
    cropName: a.string(),
    sourceType: a.string().required(),
    sourceId: a.id(),
    batchDate: a.string().required(),
    quantityReceived: a.float().required(),
    unit: a.string().required(),
    available: a.float().required(),
    availableByState: a.json(),
    status: a.string().required(),
    version: a.integer().required(),
    createdAt: a.string(),
  }),

  ProduceTxn: a.customType({
    id: a.string().required(),
    batchId: a.id().required(),
    transactionType: a.string().required(),
    quantity: a.float().required(),
    unit: a.string().required(),
    state: a.string(),
    fromState: a.string(),
    toState: a.string(),
    transactionDate: a.string().required(),
    sourceId: a.string(),
    reason: a.string(),
    notes: a.string(),
    createdAt: a.string(),
    createdBy: a.string(),
  }),

  ProduceMovementResult: a.customType({
    batch: a.ref('ProduceBatch').required(),
    transaction: a.ref('ProduceTxn').required(),
  }),

  ProduceBatchDetail: a.customType({
    batch: a.ref('ProduceBatch').required(),
    transactions: a.ref('ProduceTxn').required().array().required(),
    nextToken: a.string(),
  }),

  InputItem: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    name: a.string().required(),
    category: a.string().required(),
    unit: a.string().required(),
    quantity: a.float().required(),
    reorderLevel: a.float(),
    lowStock: a.boolean().required(),
    notes: a.string(),
    status: a.string().required(),
    version: a.integer().required(),
    updatedAt: a.string(),
  }),

  InputTxn: a.customType({
    id: a.string().required(),
    itemId: a.id().required(),
    transactionType: a.string().required(),
    quantity: a.float().required(),
    unit: a.string().required(),
    transactionDate: a.string().required(),
    balanceAfter: a.float(),
    reason: a.string(),
    notes: a.string(),
    createdAt: a.string(),
    createdBy: a.string(),
  }),

  InputMovementResult: a.customType({
    item: a.ref('InputItem').required(),
    transaction: a.ref('InputTxn').required(),
  }),

  InputItemDetail: a.customType({
    item: a.ref('InputItem').required(),
    transactions: a.ref('InputTxn').required().array().required(),
    nextToken: a.string(),
  }),

  // ─── Produce inventory (#76) ───────────────────────────────────────────────
  listProduceBatches: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      cropCode: a.string(),
      availableOnly: a.boolean(),
    })
    .returns(a.ref('ProduceBatch').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getProduceBatch: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      batchId: a.id().required(),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('ProduceBatchDetail').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  recordProduceMovement: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      batchId: a.id().required(),
      operationId: a.id().required(),
      transactionType: a.string().required(),
      quantity: a.float().required(),
      state: a.string().required(),
      transactionDate: a.string().required(),
      notes: a.string(),
    })
    .returns(a.ref('ProduceMovementResult').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  dehuskProduce: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      batchId: a.id().required(),
      operationId: a.id().required(),
      quantity: a.float().required(),
      transactionDate: a.string().required(),
      notes: a.string(),
    })
    .returns(a.ref('ProduceMovementResult').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  // ─── Farm inputs (#80, #81, §12) ─────────────────────────────────────────
  listInputItems: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      includeArchived: a.boolean(),
    })
    .returns(a.ref('InputItem').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getInputItem: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      itemId: a.id().required(),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('InputItemDetail').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  createInputItem: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      itemId: a.id().required(),
      name: a.string().required(),
      category: a.string().required(),
      unit: a.string().required(),
      reorderLevel: a.float(),
      notes: a.string(),
      openingQuantity: a.float(),
      openingDate: a.string(),
    })
    .returns(a.ref('InputItem').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateInputItem: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      itemId: a.id().required(),
      expectedVersion: a.integer().required(),
      name: a.string(),
      category: a.string(),
      reorderLevel: a.float(),
      clearReorderLevel: a.boolean(),
      notes: a.string(),
      status: a.string(),
    })
    .returns(a.ref('InputItem').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  recordInputMovement: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      itemId: a.id().required(),
      operationId: a.id().required(),
      transactionType: a.string().required(),
      quantity: a.float().required(),
      decrease: a.boolean(),
      transactionDate: a.string().required(),
      reason: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('InputMovementResult').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),
});

/**
 * Sales bounded context: buyers (§13.1–13.2) and sales (§13.3–13.5).
 * Refs stay inside this schema (ADR-0005).
 */
const sales = a.schema({
  Buyer: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    name: a.string().required(),
    contactName: a.string(),
    phone: a.string(),
    preferredSizes: a.string().required().array().required(),
    acceptableSizes: a.string().required().array().required(),
    requirementNote: a.string(),
    notes: a.string(),
    status: a.string().required(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  SaleLine: a.customType({
    sizeClass: a.string(),
    quantity: a.float().required(),
    unitPrice: a.float().required(),
    lineAmount: a.float().required(),
  }),

  SaleAllocation: a.customType({
    batchId: a.id().required(),
    state: a.string().required(),
    quantity: a.float().required(),
  }),

  Sale: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    saleDate: a.string().required(),
    buyerId: a.id(),
    buyerName: a.string(),
    cropCode: a.string().required(),
    quantityUnit: a.string().required(),
    lines: a.ref('SaleLine').required().array().required(),
    allocations: a.ref('SaleAllocation').required().array().required(),
    totalQuantity: a.float().required(),
    calculatedAmount: a.float().required(),
    actualAmountReceived: a.float(),
    difference: a.float(),
    differenceReason: a.string(),
    currency: a.string().required(),
    notes: a.string(),
    status: a.string().required(),
    deletedAt: a.string(),
    deleteReason: a.string(),
    backfilled: a.boolean(),
    source: a.string(),
    version: a.integer().required(),
    createdAt: a.string(),
    createdBy: a.string(),
    updatedAt: a.string(),
    updatedBy: a.string(),
  }),

  SalesPage: a.customType({
    sales: a.ref('Sale').required().array().required(),
    nextToken: a.string(),
  }),

  recordSale: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      saleId: a.id().required(),
      saleDate: a.string().required(),
      currency: a.string(),
      buyerId: a.id(),
      lines: a.json().required(),
      allocations: a.json().required(),
      actualAmountReceived: a.float(),
      differenceReason: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('Sale').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateSale: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      saleId: a.id().required(),
      expectedVersion: a.integer().required(),
      reason: a.string(),
      buyerId: a.id(),
      lines: a.json().required(),
      allocations: a.json().required(),
      actualAmountReceived: a.float(),
      differenceReason: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('Sale').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  archiveSale: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      saleId: a.id().required(),
      expectedVersion: a.integer().required(),
      reason: a.string(),
    })
    .returns(a.ref('Sale').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  restoreSale: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      saleId: a.id().required(),
      expectedVersion: a.integer().required(),
      reason: a.string(),
    })
    .returns(a.ref('Sale').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getSale: a
    .query()
    .arguments({ tenantId: a.id().required(), saleId: a.id().required() })
    .returns(a.ref('Sale').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listSales: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      buyerId: a.id(),
      from: a.string(),
      to: a.string(),
      includeDeleted: a.boolean(),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('SalesPage').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  backfillSale: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      saleId: a.id().required(),
      saleDate: a.string().required(),
      source: a.string().required(),
      cropCode: a.string(),
      quantityUnit: a.string(),
      currency: a.string(),
      buyerId: a.id(),
      lines: a.json().required(),
      actualAmountReceived: a.float(),
      differenceReason: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('Sale').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listBuyers: a
    .query()
    .arguments({ tenantId: a.id().required(), includeArchived: a.boolean() })
    .returns(a.ref('Buyer').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getBuyer: a
    .query()
    .arguments({ tenantId: a.id().required(), buyerId: a.id().required() })
    .returns(a.ref('Buyer').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  createBuyer: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      buyerId: a.id().required(),
      name: a.string().required(),
      contactName: a.string(),
      phone: a.string(),
      preferredSizes: a.string().required().array(),
      acceptableSizes: a.string().required().array(),
      requirementNote: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('Buyer').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateBuyer: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      buyerId: a.id().required(),
      expectedVersion: a.integer().required(),
      name: a.string(),
      contactName: a.string(),
      phone: a.string(),
      preferredSizes: a.string().required().array(),
      acceptableSizes: a.string().required().array(),
      requirementNote: a.string(),
      notes: a.string(),
      status: a.string(),
    })
    .returns(a.ref('Buyer').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),
});

/**
 * Growing bounded context: production cycles and farm activities
 * (§6.3, §14, §41.3–41.4). Refs stay inside this schema (ADR-0005).
 */
const growing = a.schema({
  ProductionCycle: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    zoneId: a.id().required(),
    zoneName: a.string(),
    growingSpaceId: a.id(),
    name: a.string().required(),
    cropName: a.string().required(),
    cropCode: a.string().required(),
    variety: a.string(),
    plantedAt: a.string(),
    expectedEndAt: a.string(),
    endedAt: a.string(),
    estimatedPlantCount: a.integer(),
    areaUsed: a.float(),
    areaUnit: a.string(),
    notes: a.string(),
    status: a.string().required(),
    activityCount: a.integer(),
    harvestCount: a.integer(),
    harvestTotals: a.json(),
    lastActivityAt: a.string(),
    lastHarvestAt: a.string(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
  }),

  FarmActivity: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    targetId: a.id().required(),
    targetType: a.string().required(),
    productionCycleId: a.id(),
    zoneId: a.id(),
    activityType: a.string().required(),
    activityDate: a.string().required(),
    notes: a.string(),
    quantity: a.float(),
    unit: a.string(),
    materialName: a.string(),
    inputItemId: a.id(),
    version: a.integer().required(),
    createdAt: a.string(),
    createdBy: a.string(),
  }),

  CycleHarvest: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    productionCycleId: a.id().required(),
    cropCode: a.string().required(),
    cropName: a.string(),
    harvestDate: a.string().required(),
    quantity: a.float().required(),
    unit: a.string().required(),
    qualityNote: a.string(),
    notes: a.string(),
    batchId: a.id().required(),
    version: a.integer().required(),
    createdAt: a.string(),
  }),

  CycleDetail: a.customType({
    cycle: a.ref('ProductionCycle').required(),
    activities: a.ref('FarmActivity').required().array().required(),
    harvests: a.ref('CycleHarvest').required().array().required(),
  }),

  recordCycleHarvest: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      cycleId: a.id().required(),
      harvestId: a.id().required(),
      harvestDate: a.string().required(),
      quantity: a.float().required(),
      unit: a.string().required(),
      qualityNote: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('CycleHarvest').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listCycles: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      includeClosed: a.boolean(),
      zoneId: a.id(),
    })
    .returns(a.ref('ProductionCycle').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  getCycle: a
    .query()
    .arguments({ tenantId: a.id().required(), cycleId: a.id().required() })
    .returns(a.ref('CycleDetail').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  createCycle: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      cycleId: a.id().required(),
      status: a.string(),
      name: a.string().required(),
      cropName: a.string().required(),
      variety: a.string(),
      zoneId: a.id().required(),
      growingSpaceId: a.id(),
      plantedAt: a.string(),
      expectedEndAt: a.string(),
      estimatedPlantCount: a.integer(),
      areaUsed: a.float(),
      areaUnit: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('ProductionCycle').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateCycle: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      cycleId: a.id().required(),
      expectedVersion: a.integer().required(),
      status: a.string(),
      statusDate: a.string(),
      name: a.string(),
      cropName: a.string(),
      variety: a.string(),
      zoneId: a.id(),
      growingSpaceId: a.id(),
      plantedAt: a.string(),
      expectedEndAt: a.string(),
      estimatedPlantCount: a.integer(),
      areaUsed: a.float(),
      areaUnit: a.string(),
      notes: a.string(),
    })
    .returns(a.ref('ProductionCycle').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  recordActivity: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      activityId: a.id().required(),
      targetId: a.id().required(),
      activityType: a.string().required(),
      activityDate: a.string().required(),
      notes: a.string(),
      quantity: a.float(),
      unit: a.string(),
      materialName: a.string(),
      inputItemId: a.id(),
    })
    .returns(a.ref('FarmActivity').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  listActivities: a
    .query()
    .arguments({ tenantId: a.id().required(), targetId: a.id().required() })
    .returns(a.ref('FarmActivity').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  archiveActivity: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      activityId: a.id().required(),
      expectedVersion: a.integer().required(),
    })
    .returns(a.ref('FarmActivity').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),
});

/**
 * Access bounded context: members, invites, roles and profiles (#121, #37).
 * Refs stay inside this schema (ADR-0005).
 */
const access = a.schema({
  TeamMember: a.customType({
    userId: a.string().required(),
    email: a.string(),
    profileId: a.string().required(),
    profileName: a.string(),
    status: a.string().required(),
    isMe: a.boolean().required(),
    version: a.integer().required(),
    joinedAt: a.string(),
  }),

  TeamInvite: a.customType({
    email: a.string().required(),
    profileId: a.string().required(),
    profileName: a.string(),
    expiresAt: a.string().required(),
    invitedBy: a.string(),
  }),

  TeamRole: a.customType({
    id: a.string().required(),
    name: a.string().required(),
    entitlements: a.string().required().array().required(),
    isSystem: a.boolean().required(),
    status: a.string().required(),
    version: a.integer().required(),
  }),

  TeamProfile: a.customType({
    id: a.string().required(),
    name: a.string().required(),
    roleIds: a.string().required().array().required(),
    isSystem: a.boolean().required(),
    status: a.string().required(),
    version: a.integer().required(),
  }),

  Team: a.customType({
    members: a.ref('TeamMember').required().array().required(),
    invites: a.ref('TeamInvite').required().array().required(),
    roles: a.ref('TeamRole').required().array().required(),
    profiles: a.ref('TeamProfile').required().array().required(),
    catalogue: a.string().required().array().required(),
    myEntitlements: a.string().required().array().required(),
  }),

  InviteResult: a.customType({
    email: a.string().required(),
    profileId: a.string().required(),
    profileName: a.string(),
    expiresAt: a.string().required(),
  }),

  MyInvite: a.customType({
    tenantId: a.string().required(),
    tenantName: a.string().required(),
    invitedBy: a.string(),
    expiresAt: a.string().required(),
  }),

  JoinResult: a.customType({
    tenantId: a.string().required(),
    joined: a.boolean().required(),
  }),

  MemberUpdate: a.customType({
    userId: a.string().required(),
    profileId: a.string().required(),
    status: a.string().required(),
    version: a.integer().required(),
  }),

  getTeam: a
    .query()
    .arguments({ tenantId: a.id().required() })
    .returns(a.ref('Team').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  myInvites: a
    .query()
    .returns(a.ref('MyInvite').required().array().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  inviteMember: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      email: a.string().required(),
      profileId: a.string().required(),
    })
    .returns(a.ref('InviteResult').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  revokeInvite: a
    .mutation()
    .arguments({ tenantId: a.id().required(), email: a.string().required() })
    .returns(a.boolean().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  acceptInvite: a
    .mutation()
    .arguments({ tenantId: a.id().required() })
    .returns(a.ref('JoinResult').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  updateMember: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      userId: a.string().required(),
      expectedVersion: a.integer().required(),
      profileId: a.string(),
      status: a.string(),
    })
    .returns(a.ref('MemberUpdate').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  saveRole: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      roleId: a.string().required(),
      expectedVersion: a.integer().required(),
      name: a.string().required(),
      entitlements: a.string().required().array().required(),
      status: a.string(),
    })
    .returns(a.ref('TeamRole').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),

  saveProfile: a
    .mutation()
    .arguments({
      tenantId: a.id().required(),
      profileId: a.string().required(),
      expectedVersion: a.integer().required(),
      name: a.string().required(),
      roleIds: a.string().required().array().required(),
      status: a.string(),
    })
    .returns(a.ref('TeamProfile').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),
});

/**
 * Reports bounded context: analytics (§17). One read-only report returned as
 * AWSJSON; its shape is defined by src/domain/analytics (ADR-0005).
 */
const reports = a.schema({
  getAnalytics: a
    .query()
    .arguments({
      tenantId: a.id().required(),
      farmId: a.id().required(),
      from: a.string().required(),
      to: a.string().required(),
      includeNonProducing: a.boolean(),
    })
    .returns(a.json().required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(farmApi)),
});

/** Client typing for the core schema (the web client uses untyped calls). */
export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema: a.combine([schema, stock, sales, growing, access, reports]),
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
