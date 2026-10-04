/**
 * Dehusked samples (#62–#67, SRS §9, §41.6, §41.10).
 * One sample per tree harvest (keyed by the harvest). Re-recording corrects it
 * with an audit trail (§31). A sample never touches produce inventory.
 */

import { z } from 'zod';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  MEASUREMENT_UNITS,
  SIZE_CLASSES,
  WEIGHT_UNITS,
} from '../../../../src/domain/samples';
import {
  createWithAudit,
  getById,
  getItem,
  toView,
  updateWithAudit,
} from '../lib/crud';
import { ApiError, notFound } from '../lib/errors';
import { tenantOperation } from '../lib/operation';
import { refreshTreeSampleSnapshot } from '../lib/treeSnapshot';

const id = z.string().refine(isUlid, 'must be a ULID');
const positive = z.number().positive().max(100_000).nullish();

export const recordCoconutSample = tenantOperation({
  name: 'recordCoconutSample',
  entitlement: 'sample.record',
  input: z.object({
    tenantId: z.string().min(1),
    harvestId: id,
    sampleId: id,
    sizeClass: z.enum(SIZE_CLASSES),
    weight: positive,
    weightUnit: z.enum(WEIGHT_UNITS).nullish(),
    diameter: positive,
    circumference: positive,
    measurementUnit: z.enum(MEASUREMENT_UNITS).nullish(),
    notes: z.string().trim().max(1000).nullish(),
  }),
  handler: async (input, ctx) => {
    const harvest = await getById(input.harvestId, ctx);
    if (
      !harvest ||
      harvest['entityType'] !== 'TreeHarvest' ||
      harvest['deletedAt']
    )
      throw notFound('Harvest not found');
    if (harvest['quantity'] == null)
      throw new ApiError(
        'VALIDATION',
        'harvestId: record the harvest count first'
      );

    const treeId = String(harvest['treeId']);
    const sampledAt = String(harvest['harvestDate']);
    const key = keys.sample(
      ctx.access.tenantId,
      treeId,
      sampledAt,
      input.harvestId
    );
    const values = {
      sizeClass: input.sizeClass,
      weight: input.weight ?? undefined,
      weightUnit: input.weight ? (input.weightUnit ?? 'G') : undefined,
      diameter: input.diameter ?? undefined,
      circumference: input.circumference ?? undefined,
      measurementUnit:
        input.diameter || input.circumference
          ? (input.measurementUnit ?? 'CM')
          : undefined,
      notes: input.notes ?? undefined,
    };

    const existing = await getItem(key);
    let item;
    if (!existing) {
      item = await createWithAudit({
        ctx,
        key,
        id: input.sampleId,
        entityType: 'CoconutSample',
        attributes: {
          farmId: harvest['farmId'],
          roundId: harvest['roundId'],
          harvestId: input.harvestId,
          treeId,
          treeCode: harvest['treeCode'],
          sampledAt,
          sampleCount: 1,
          ...values,
          dehuskedPhotoIds: [],
        },
        action: 'sample.record',
      });
    } else {
      const unchanged = Object.entries(values).every(
        ([k, v]) => (existing[k] ?? undefined) === v
      );
      item = unchanged
        ? existing
        : await updateWithAudit({
            ctx,
            key,
            expectedVersion: Number(existing['version']),
            changes: values,
            action: 'sample.correct',
          });
    }
    await refreshTreeSampleSnapshot(ctx, treeId);
    return toView(item);
  },
});
