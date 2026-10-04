/**
 * Per-tree derived snapshot (ADR-0002 "due-soon computed on read from a
 * per-tree prediction snapshot"). Recomputed from the tree's harvest timeline
 * whenever a harvest is recorded or corrected; never edited by users.
 *
 * Written with UpdateCommand SET on derived attributes only, so it never
 * clobbers concurrent user edits (which use optimistic `version` on other fields).
 */

import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { treeYieldSummary } from '../../../../src/domain/coconut';
import { keys } from '../../../../src/domain/keys';
import { predictNextPlucking } from '../../../../src/domain/prediction';
import { type SizeClass, sizeHistory } from '../../../../src/domain/samples';
import { type Item, getById, queryPrefix } from './crud';
import { ddb, tableName } from './db';
import type { TenantContext } from './operation';

export async function treeHarvests(
  ctx: TenantContext,
  treeId: string
): Promise<Item[]> {
  const items = await queryPrefix(
    keys.treePk(ctx.access.tenantId, treeId),
    'H#'
  );
  return items.filter(
    i =>
      i['tenantId'] === ctx.access.tenantId && i['entityType'] === 'TreeHarvest'
  );
}

const asHarvest = (h: Item) => ({
  harvestDate: String(h['harvestDate']),
  quantity: h['quantity'] as number | null | undefined,
  deletedAt: h['deletedAt'] as string | null | undefined,
  excludeFromPrediction: h['excludeFromPrediction'] as
    | boolean
    | null
    | undefined,
});

export function computeTreeDerived(harvests: readonly Item[], today: string) {
  const list = harvests.map(asHarvest);
  return {
    summary: treeYieldSummary(list, today),
    prediction: predictNextPlucking(list),
  };
}

/** Recompute and store the snapshot for one tree. */
export async function refreshTreeSnapshot(
  ctx: TenantContext,
  treeId: string
): Promise<void> {
  const tree = await getById(treeId, ctx);
  if (!tree || tree['entityType'] !== 'Tree') return;
  const today = ctx.now.slice(0, 10);
  const { summary, prediction } = computeTreeDerived(
    await treeHarvests(ctx, treeId),
    today
  );
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: tree['PK'], SK: tree['SK'] },
      UpdateExpression:
        'SET prediction = :p, lastHarvestDate = :d, lastQuantity = :q, harvestCount = :n, lifetimeTotal = :t',
      ConditionExpression: 'tenantId = :tenant',
      ExpressionAttributeValues: {
        ':p': prediction,
        ':d': summary.lastHarvestDate,
        ':q': summary.lastQuantity,
        ':n': summary.harvestCount,
        ':t': summary.lifetimeTotal,
        ':tenant': ctx.access.tenantId,
      },
    })
  );
}

// ─── Sample snapshot (§9.4) ─────────────────────────────────────────────────────

export async function treeSamples(
  ctx: TenantContext,
  treeId: string
): Promise<Item[]> {
  const items = await queryPrefix(
    keys.treePk(ctx.access.tenantId, treeId),
    'S#'
  );
  return items.filter(
    i =>
      i['tenantId'] === ctx.access.tenantId &&
      i['entityType'] === 'CoconutSample'
  );
}

export function computeSizeHistory(samples: readonly Item[]) {
  return sizeHistory(
    samples.map(s => ({
      sampledAt: String(s['sampledAt']),
      sizeClass: s['sizeClass'] as SizeClass,
      deletedAt: s['deletedAt'] as string | null | undefined,
    }))
  );
}

/** Store latest size + tendency on the tree for list filters and planning. */
export async function refreshTreeSampleSnapshot(
  ctx: TenantContext,
  treeId: string
): Promise<void> {
  const tree = await getById(treeId, ctx);
  if (!tree || tree['entityType'] !== 'Tree') return;
  const h = computeSizeHistory(await treeSamples(ctx, treeId));
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: tree['PK'], SK: tree['SK'] },
      UpdateExpression:
        'SET latestSampleSize = :l, sizeTendency = :t, sampleCount = :n',
      ConditionExpression: 'tenantId = :tenant',
      ExpressionAttributeValues: {
        ':l': h.latest,
        ':t': h.tendency,
        ':n': h.sampleCount,
        ':tenant': ctx.access.tenantId,
      },
    })
  );
}
