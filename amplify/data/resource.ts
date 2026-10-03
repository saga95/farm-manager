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
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
