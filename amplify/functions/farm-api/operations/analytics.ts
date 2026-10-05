/**
 * Analytics report (#99, #100, SRS §17, SCR-014, SCR-027).
 *
 * Loads the farm's records once and hands them to the pure aggregations in
 * src/domain/analytics. Sized for a small farm (tens of trees, hundreds of
 * records a year): partition queries in parallel, no scans. Producing trees
 * only by default (#99).
 */

import { z } from 'zod';
import {
  type AHarvest,
  type ASale,
  type ASample,
  type ATxn,
  coconutInsights,
  cropHarvests,
  monthlyYield,
  roundStats,
  salesSummary,
  sampleDistribution,
  stockAdjustments,
  treeStats,
} from '../../../../src/domain/analytics';
import { type StockByState, stockOf } from '../../../../src/domain/inventory';
import { isUlid, keys } from '../../../../src/domain/keys';
import { isLowStock } from '../../../../src/domain/inputs';
import { type Item, queryPrefix, requireItem } from '../lib/crud';
import { ApiError } from '../lib/errors';
import { tenantOperation } from '../lib/operation';
import { treeHarvests, treeSamples } from '../lib/treeSnapshot';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const getAnalytics = tenantOperation({
  name: 'getAnalytics',
  entitlement: 'analytics.view',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: z.string().refine(isUlid, 'must be a ULID'),
    from: isoDate,
    to: isoDate,
    includeNonProducing: z.boolean().nullish(),
  }),
  handler: async (input, ctx) => {
    if (input.from > input.to)
      throw new ApiError('VALIDATION', 'from: must be on or before "to"');
    const { tenantId } = ctx.access;
    await requireItem(keys.farm(tenantId, input.farmId), ctx, 'Farm');
    const period = { from: input.from, to: input.to };
    const today = ctx.now.slice(0, 10);
    const pk = keys.farmPk(tenantId, input.farmId);
    const own = (i: Item) => i['tenantId'] === tenantId;

    const [trees, rounds, sales, batches, inputs, cycles] = await Promise.all([
      queryPrefix(pk, keys.prefix.trees),
      queryPrefix(pk, keys.prefix.rounds),
      queryPrefix(pk, keys.prefix.sales),
      queryPrefix(pk, keys.prefix.batches),
      queryPrefix(pk, keys.prefix.inputs),
      queryPrefix(pk, keys.prefix.cycles),
    ]);
    const activeTrees = trees.filter(t => own(t) && t['entityType'] === 'Tree');
    const [harvestsByTree, samplesByTree, txnsByBatch, cycleHarvests] =
      await Promise.all([
        Promise.all(activeTrees.map(t => treeHarvests(ctx, String(t['id'])))),
        Promise.all(activeTrees.map(t => treeSamples(ctx, String(t['id'])))),
        Promise.all(
          batches.map(b =>
            queryPrefix(
              keys.produceTxn(tenantId, String(b['id']), '0000-00-00', 'x').PK,
              'TX#'
            ).then(txns =>
              txns.map(x => ({
                ...x,
                cropCode: b['cropCode'],
                unit: x['unit'] ?? b['unit'],
              }))
            )
          )
        ),
        Promise.all(
          cycles
            .filter(own)
            .map(c =>
              queryPrefix(keys.cycleHarvestPk(tenantId, String(c['id'])), 'H#')
            )
        ),
      ]);

    // ── Coconut (§17.1, §17.2) ──
    const harvests = harvestsByTree.flat() as unknown as AHarvest[];
    const samples = samplesByTree.flat() as unknown as ASample[];
    const stats = activeTrees.map((t, i) =>
      treeStats(
        {
          id: String(t['id']),
          code: String(t['code']),
          status: String(t['status']),
        },
        (harvestsByTree[i] ?? []) as unknown as AHarvest[],
        (samplesByTree[i] ?? []) as unknown as ASample[],
        period,
        today
      )
    );
    const shown = input.includeNonProducing
      ? stats
      : stats.filter(s => s.status === 'PRODUCING');
    const shownIds = new Set(shown.map(s => s.treeId));
    const shownHarvests = harvests.filter(h => shownIds.has(h.treeId));
    const periodNuts = shown.reduce((n, s) => n + s.periodNuts, 0);
    const periodHarvests = shown.reduce((n, s) => n + s.periodHarvests, 0);
    const snapshot = new Map(activeTrees.map(t => [String(t['id']), t]));

    const coconut = {
      totals: {
        nuts: periodNuts,
        harvestRecords: periodHarvests,
        avgPerHarvest: periodHarvests
          ? Math.round((periodNuts / periodHarvests) * 10) / 10
          : null,
        producingTrees: stats.filter(s => s.status === 'PRODUCING').length,
        trees: stats.length,
      },
      byMonth: monthlyYield(shownHarvests, period),
      rounds: roundStats(rounds.filter(own) as never, harvests, period),
      samples: sampleDistribution(
        samples.filter(s => shownIds.has(s.treeId)),
        period
      ),
      trees: shown
        .map(s => ({
          ...s,
          nextEstimate:
            (snapshot.get(s.treeId)?.['prediction'] as Item | undefined)?.[
              'estimateDate'
            ] ?? null,
        }))
        .sort(
          (a, b) => b.periodNuts - a.periodNuts || a.code.localeCompare(b.code)
        ),
      insights: coconutInsights(stats),
    };

    // ── Sales (§17.3, CALC-014) ──
    const salesReport = salesSummary(
      sales.filter(
        s => own(s) && s['entityType'] === 'Sale'
      ) as unknown as ASale[],
      period
    );

    // ── Stock (§17.4) ──
    const stockByCrop = new Map<
      string,
      {
        cropCode: string;
        cropName: string;
        unit: string;
        byState: StockByState;
        total: number;
      }
    >();
    for (const b of batches.filter(x => own(x) && x['status'] !== 'VOID')) {
      const crop = String(b['cropCode'] ?? 'COCONUT');
      const unit = String(b['unit'] ?? 'NUT');
      const k = `${crop}#${unit}`;
      const byState = stockOf(crop, b['availableByState'] as StockByState);
      const e = stockByCrop.get(k) ?? {
        cropCode: crop,
        cropName: String(b['cropName'] ?? crop),
        unit,
        byState: stockOf(crop, {}),
        total: 0,
      };
      for (const [s, v] of Object.entries(byState)) {
        const key = s as keyof StockByState;
        e.byState[key] =
          Math.round(((e.byState[key] ?? 0) + (v ?? 0)) * 1000) / 1000;
      }
      e.total =
        Math.round((e.total + Number(b['available'] ?? 0)) * 1000) / 1000;
      stockByCrop.set(k, e);
    }
    const inputItems = inputs.filter(
      i =>
        own(i) && i['entityType'] === 'InputItem' && i['status'] !== 'ARCHIVED'
    );
    const stock = {
      current: [...stockByCrop.values()],
      adjustments: stockAdjustments(
        txnsByBatch.flat() as unknown as ATxn[],
        period
      ),
      inputs: inputItems.length,
      lowStock: inputItems
        .filter(i =>
          isLowStock(
            Number(i['quantity'] ?? 0),
            i['reorderLevel'] as number | null
          )
        )
        .map(i => ({
          id: i['id'],
          name: i['name'],
          quantity: i['quantity'],
          unit: i['unit'],
          reorderLevel: i['reorderLevel'],
        })),
    };

    // ── Polytunnel / other crops (§17.5) ──
    const crops = cropHarvests(
      cycleHarvests
        .flat()
        .filter(h => own(h) && h['entityType'] === 'GenericHarvest') as never,
      period
    );

    return JSON.stringify({
      period,
      generatedAt: ctx.now,
      includeNonProducing: Boolean(input.includeNonProducing),
      coconut,
      sales: salesReport,
      stock,
      crops,
    });
  },
});
