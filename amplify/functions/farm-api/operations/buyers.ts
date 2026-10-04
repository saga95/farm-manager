/**
 * Buyers (#83, #84, SRS §13.1–13.2, US-018, AC-SL-001).
 * Tenant-level records with editable size preferences. A buyer "type" never
 * implies a size; preferences live on the buyer and are normalized so a size
 * is never both preferred and merely acceptable.
 */

import { z } from 'zod';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  BUYER_STATUSES,
  normalizeSizePrefs,
} from '../../../../src/domain/sales';
import {
  createWithAudit,
  getById,
  queryPrefix,
  toView,
  updateWithAudit,
} from '../lib/crud';
import { notFound } from '../lib/errors';
import { tenantOperation } from '../lib/operation';

const id = z.string().refine(isUlid, 'must be a ULID');
const text = (max: number) => z.string().trim().max(max).nullish();
const sizes = z.array(z.string().max(20)).max(4).nullish();

const fields = {
  contactName: text(120),
  phone: text(40),
  requirementNote: text(1000),
  notes: text(1000),
};

export const createBuyer = tenantOperation({
  name: 'createBuyer',
  entitlement: 'buyer.manage',
  input: z.object({
    tenantId: z.string().min(1),
    buyerId: id,
    name: z.string().trim().min(1).max(120),
    preferredSizes: sizes,
    acceptableSizes: sizes,
    ...fields,
  }),
  handler: async (input, ctx) => {
    const prefs = normalizeSizePrefs(
      input.preferredSizes ?? [],
      input.acceptableSizes ?? []
    );
    const item = await createWithAudit({
      ctx,
      key: keys.buyer(ctx.access.tenantId, input.buyerId),
      id: input.buyerId,
      entityType: 'Buyer',
      attributes: {
        name: input.name,
        ...prefs,
        contactName: input.contactName ?? undefined,
        phone: input.phone ?? undefined,
        requirementNote: input.requirementNote ?? undefined,
        notes: input.notes ?? undefined,
        status: 'ACTIVE',
      },
      action: 'buyer.create',
    });
    return toView(item);
  },
});

export const updateBuyer = tenantOperation({
  name: 'updateBuyer',
  entitlement: 'buyer.manage',
  input: z.object({
    tenantId: z.string().min(1),
    buyerId: id,
    expectedVersion: z.number().int().positive(),
    name: z.string().trim().min(1).max(120).nullish(),
    preferredSizes: sizes,
    acceptableSizes: sizes,
    status: z.enum(BUYER_STATUSES).nullish(),
    ...fields,
  }),
  handler: async (input, ctx) => {
    const key = keys.buyer(ctx.access.tenantId, input.buyerId);
    const current = await getById(input.buyerId, ctx);
    if (!current || current['entityType'] !== 'Buyer')
      throw notFound('Buyer not found');
    const prefs =
      input.preferredSizes || input.acceptableSizes
        ? normalizeSizePrefs(
            input.preferredSizes ??
              (current['preferredSizes'] as string[]) ??
              [],
            input.acceptableSizes ??
              (current['acceptableSizes'] as string[]) ??
              []
          )
        : {};
    const item = await updateWithAudit({
      ctx,
      key,
      expectedVersion: input.expectedVersion,
      changes: {
        name: input.name ?? undefined,
        ...prefs,
        // Optional text: undefined keeps, null clears (sent as "" by the client)
        contactName:
          input.contactName === undefined
            ? undefined
            : input.contactName || null,
        phone: input.phone === undefined ? undefined : input.phone || null,
        requirementNote:
          input.requirementNote === undefined
            ? undefined
            : input.requirementNote || null,
        notes: input.notes === undefined ? undefined : input.notes || null,
        status: input.status ?? undefined,
      },
      action: 'buyer.update',
    });
    return toView(item);
  },
});

export const listBuyers = tenantOperation({
  name: 'listBuyers',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    includeArchived: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    const items = await queryPrefix(
      keys.tenantPk(ctx.access.tenantId),
      keys.prefix.buyers
    );
    return items
      .filter(i => input.includeArchived || i['status'] !== 'ARCHIVED')
      .sort((a, b) => String(a['name']).localeCompare(String(b['name'])))
      .map(i => toView(i));
  },
});

export const getBuyer = tenantOperation({
  name: 'getBuyer',
  entitlement: 'farm.view',
  input: z.object({ tenantId: z.string().min(1), buyerId: id }),
  handler: async (input, ctx) => {
    const b = await getById(input.buyerId, ctx);
    if (!b || b['entityType'] !== 'Buyer') throw notFound('Buyer not found');
    return toView(b);
  },
});
