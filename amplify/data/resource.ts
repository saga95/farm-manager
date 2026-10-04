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
    version: a.integer().required(),
    createdAt: a.string(),
    updatedAt: a.string(),
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
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
