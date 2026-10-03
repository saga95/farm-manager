/**
 * createTenant (SCR-002 setup, US-001/002, ADR-0001 §8):
 * Tenant + seeded default roles/profiles + caller as Owner + first Farm + audit,
 * in ONE transaction. Idempotent on the client-generated tenantId (ADR-0004).
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  SYSTEM_PROFILE_IDS,
  seedDefaultRbac,
} from '../../../../src/domain/rbac';
import { ddb, tableName } from '../lib/db';
import { ApiError } from '../lib/errors';
import { userOperation } from '../lib/operation';

const ulidSchema = z.string().refine(isUlid, 'must be a ULID');
const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const AREA_UNITS = ['ACRE', 'HECTARE', 'PERCH', 'SQ_M'] as const;

export const createTenantInput = z.object({
  tenantId: ulidSchema,
  name: z.string().trim().min(1).max(80),
  defaultTimezone: z.string().refine(isTimeZone, 'must be an IANA time zone'),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/, 'must be an ISO 4217 code'),
  defaultLocale: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'must be a locale like en or si-LK'),
  farmId: ulidSchema,
  farmName: z.string().trim().min(1).max(80),
  farmArea: z.number().positive().max(1_000_000).nullish(),
  farmAreaUnit: z.enum(AREA_UNITS).nullish(),
  farmLocationLabel: z.string().trim().max(120).nullish(),
});

export type CreateTenantInput = z.infer<typeof createTenantInput>;

export const createTenant = userOperation({
  name: 'createTenant',
  input: createTenantInput,
  handler: async (input, ctx) => {
    const TableName = tableName();
    const { tenantId, farmId } = input;
    const { roles, profiles } = seedDefaultRbac();
    const base = {
      tenantId,
      createdAt: ctx.now,
      createdBy: ctx.userId,
      updatedAt: ctx.now,
    };

    const puts: Record<string, unknown>[] = [
      {
        ...keys.tenant(tenantId),
        ...keys.byId(tenantId),
        GSI2SK: 'TENANT',
        entityType: 'Tenant',
        ...base,
        name: input.name,
        status: 'ACTIVE',
        defaultTimezone: input.defaultTimezone,
        defaultCurrency: input.defaultCurrency,
        defaultLocale: input.defaultLocale,
        rbacVersion: 1,
      },
      ...roles.map(r => ({
        ...keys.role(tenantId, r.id),
        entityType: 'Role',
        ...base,
        ...r,
      })),
      ...profiles.map(p => ({
        ...keys.profile(tenantId, p.id),
        entityType: 'Profile',
        ...base,
        ...p,
      })),
      {
        ...keys.member(tenantId, ctx.userId),
        ...keys.memberByUser(ctx.userId, tenantId),
        entityType: 'TenantMember',
        ...base,
        userId: ctx.userId,
        email: ctx.email,
        tenantName: input.name,
        profileId: SYSTEM_PROFILE_IDS.owner,
        status: 'ACTIVE',
      },
      {
        ...keys.farm(tenantId, farmId),
        ...keys.byId(farmId),
        GSI2SK: 'FARM',
        entityType: 'Farm',
        ...base,
        id: farmId,
        farmId,
        version: 1,
        updatedBy: ctx.userId,
        name: input.farmName,
        area: input.farmArea ?? undefined,
        areaUnit: input.farmAreaUnit ?? undefined,
        locationLabel: input.farmLocationLabel ?? undefined,
        timezone: input.defaultTimezone,
        status: 'ACTIVE',
      },
      {
        ...keys.audit(tenantId, tenantId, ctx.now, ulid()),
        entityType: 'AuditLog',
        tenantId,
        at: ctx.now,
        actorId: ctx.userId,
        action: 'tenant.create',
        entityId: tenantId,
        details: { farmId, seededProfiles: profiles.map(p => p.id) },
      },
    ];

    try {
      await ddb.send(
        new TransactWriteCommand({
          // Exact retries within 10 min are de-duplicated by DynamoDB as well.
          ClientRequestToken: `createTenant-${tenantId}`,
          TransactItems: puts.map(Item => ({
            Put: {
              TableName,
              Item,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          })),
        })
      );
      return { tenantId, farmId, replayed: false };
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      // Idempotent replay: same caller already created this tenant + farm.
      const { Item } = await ddb.send(
        new GetCommand({ TableName, Key: keys.tenant(tenantId) })
      );
      if (Item && Item['createdBy'] === ctx.userId) {
        const farm = await ddb.send(
          new GetCommand({ TableName, Key: keys.farm(tenantId, farmId) })
        );
        if (farm.Item) return { tenantId, farmId, replayed: true };
      }
      throw new ApiError('CONFLICT', 'Tenant id already in use');
    }
  },
});
