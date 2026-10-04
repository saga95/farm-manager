/**
 * Tree history (#59, SCR-007 §7.2) and next-plucking planning (#71–#74, §10).
 */

import { z } from 'zod';
import { compareTreeCodes } from '../../../../src/domain/coconut';
import { isUlid, keys } from '../../../../src/domain/keys';
import {
  DUE_BUCKETS,
  type Prediction,
  daysBetween,
  dueBucket,
} from '../../../../src/domain/prediction';
import { getById, queryPrefix, toView } from '../lib/crud';
import { notFound } from '../lib/errors';
import { tenantOperation } from '../lib/operation';
import { computeTreeDerived, treeHarvests } from '../lib/treeSnapshot';

const id = z.string().refine(isUlid, 'must be a ULID');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const getTreeHistory = tenantOperation({
  name: 'getTreeHistory',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    treeId: id,
    today: isoDate.nullish(),
  }),
  handler: async (input, ctx) => {
    const tree = await getById(input.treeId, ctx);
    if (!tree || tree['entityType'] !== 'Tree')
      throw notFound('Tree not found');
    const today = input.today ?? ctx.now.slice(0, 10);
    const harvests = (await treeHarvests(ctx, input.treeId)).filter(
      h => !h['deletedAt']
    );
    const { summary, prediction } = computeTreeDerived(harvests, today);
    return {
      tree: toView(tree),
      harvests: harvests
        .sort((a, b) =>
          String(b['harvestDate']).localeCompare(String(a['harvestDate']))
        )
        .map(h => toView(h)),
      summary,
      prediction,
    };
  },
});

/** §10.2/§10.3: producing trees with their estimate, grouped for planning. */
export const listDueTrees = tenantOperation({
  name: 'listDueTrees',
  entitlement: 'farm.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: id,
    today: isoDate.nullish(),
  }),
  handler: async (input, ctx) => {
    const today = input.today ?? ctx.now.slice(0, 10);
    const trees = (
      await queryPrefix(
        keys.farmPk(ctx.access.tenantId, input.farmId),
        keys.prefix.trees
      )
    ).filter(t => t['status'] === 'PRODUCING');
    const rows = trees.map(t => {
      const prediction = (t['prediction'] as Prediction | undefined) ?? null;
      const bucket = prediction
        ? dueBucket(prediction, today)
        : 'NOT_ENOUGH_HISTORY';
      const last = (t['lastHarvestDate'] as string | null | undefined) ?? null;
      return {
        tree: toView<Record<string, unknown>>(t),
        bucket,
        prediction,
        lastHarvestDate: last,
        lastQuantity: (t['lastQuantity'] as number | null | undefined) ?? null,
        daysSinceLast: last ? daysBetween(last, today) : null,
      };
    });
    // §10.3: sort by predicted date (earliest first); no-history trees last, by code
    return rows.sort((a, b) => {
      const ba = DUE_BUCKETS.indexOf(a.bucket);
      const bb = DUE_BUCKETS.indexOf(b.bucket);
      if (ba !== bb) return ba - bb;
      const ea = a.prediction?.estimateDate ?? '9999';
      const eb = b.prediction?.estimateDate ?? '9999';
      return ea === eb
        ? compareTreeCodes(String(a.tree['code']), String(b.tree['code']))
        : ea.localeCompare(eb);
    });
  },
});
