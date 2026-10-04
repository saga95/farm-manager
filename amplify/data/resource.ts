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
    deletedAt: a.string(),
    deleteReason: a.string(),
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
    updatedBy: a.string(),
  }),

  ProduceBatch: a.customType({
    id: a.id().required(),
    tenantId: a.id().required(),
    farmId: a.id().required(),
    cropCode: a.string().required(),
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

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
