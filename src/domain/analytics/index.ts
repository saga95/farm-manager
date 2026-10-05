/**
 * Analytics (SRS §17, CALC-001..014). Pure aggregation over plain records, so
 * the API, the web app and the future mobile client compute identical numbers.
 *
 * Wording rules (§17.6) are enforced by WHAT we return: recorded facts and
 * derived statistics only (totals, averages, medians, day counts). Nothing
 * here labels a tree "poor"; a tree without records is reported as "no
 * recent record", never as low-yielding.
 */

import { roundQty } from '../inventory';
import { intervals, median, validDates } from '../prediction';
import { type SizeClass, sizeHistory } from '../samples';

/** Inclusive date range (YYYY-MM-DD). */
export interface Period {
  from: string;
  to: string;
}

export const inPeriod = (date: string, p: Period) =>
  date >= p.from && date <= p.to;
/** "2026-03-14" → "2026-03" */
export const monthOf = (date: string) => date.slice(0, 7);

/** Every month in the period, so empty months show as 0 (not missing). */
export function monthsIn(p: Period): string[] {
  const out: string[] = [];
  let [y, m] = p.from.slice(0, 7).split('-').map(Number) as [number, number];
  const [ey, em] = p.to.slice(0, 7).split('-').map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000
  );

// ─── Coconut (§17.1, §17.2) ───────────────────────────────────────────────────

export interface AHarvest {
  treeId: string;
  roundId?: string | null;
  harvestDate: string;
  quantity?: number | null;
  deletedAt?: string | null;
  excludeFromPrediction?: boolean | null;
}

export interface ATree {
  id: string;
  code: string;
  status: string;
}

export interface ASample {
  treeId: string;
  sampledAt: string;
  sizeClass: SizeClass;
  deletedAt?: string | null;
}

export interface ARound {
  id: string;
  roundDate: string;
  status: string;
  totalNuts?: number | null;
  deletedAt?: string | null;
  unattributedQuantity?: number | null;
}

const valid = (h: AHarvest) => !h.deletedAt && h.quantity != null;

export interface TreeStats {
  treeId: string;
  code: string;
  status: string;
  periodNuts: number;
  periodHarvests: number;
  lifetimeNuts: number;
  harvestCount: number;
  /** CALC-003 over all valid records; null with no records */
  average: number | null;
  best: number | null;
  lastPlucked: string | null;
  daysSinceLast: number | null;
  /** CALC-005 over prediction-eligible dates; null with < 1 interval */
  medianInterval: number | null;
  latestSampleSize: SizeClass | null;
  sizeCounts: Record<SizeClass, number>;
  sampleCount: number;
}

export function treeStats(
  tree: ATree,
  harvests: readonly AHarvest[],
  samples: readonly ASample[],
  period: Period,
  today: string
): TreeStats {
  const all = harvests
    .filter(valid)
    .sort((a, b) => a.harvestDate.localeCompare(b.harvestDate));
  const periodRows = all.filter(h => inPeriod(h.harvestDate, period));
  const qty = (h: AHarvest) => h.quantity ?? 0;
  const lifetime = all.reduce((s, h) => s + qty(h), 0);
  const last = all.at(-1)?.harvestDate ?? null;
  const gaps = intervals(validDates(harvests));
  const sh = sizeHistory(samples);
  return {
    treeId: tree.id,
    code: tree.code,
    status: tree.status,
    periodNuts: periodRows.reduce((s, h) => s + qty(h), 0),
    periodHarvests: periodRows.length,
    lifetimeNuts: lifetime,
    harvestCount: all.length,
    average: all.length ? Math.round((lifetime / all.length) * 10) / 10 : null,
    best: all.length ? Math.max(...all.map(qty)) : null,
    lastPlucked: last,
    daysSinceLast: last ? daysBetween(last, today) : null,
    medianInterval: gaps.length ? median(gaps) : null,
    latestSampleSize: sh.latest,
    sizeCounts: sh.counts,
    sampleCount: sh.sampleCount,
  };
}

export interface MonthPoint {
  month: string;
  value: number;
  count: number;
}

/** Yield trend by month (§17.1): nuts and number of tree harvests. */
export function monthlyYield(
  harvests: readonly AHarvest[],
  period: Period
): MonthPoint[] {
  const months = new Map(
    monthsIn(period).map(m => [m, { month: m, value: 0, count: 0 }])
  );
  for (const h of harvests) {
    if (!valid(h) || !inPeriod(h.harvestDate, period)) continue;
    const p = months.get(monthOf(h.harvestDate));
    if (p) {
      p.value += h.quantity ?? 0;
      p.count += 1;
    }
  }
  return [...months.values()];
}

export interface RoundStats {
  rounds: number;
  /** nuts incl. those not tied to a tree (backfill) */
  totalNuts: number;
  avgTreesPerRound: number | null;
  avgNutsPerRound: number | null;
  /** CALC-003 over tree harvests in these rounds */
  avgNutsPerTree: number | null;
}

/** §17.2 over COMPLETE, non-deleted rounds in the period. */
export function roundStats(
  rounds: readonly ARound[],
  harvests: readonly AHarvest[],
  period: Period
): RoundStats {
  const done = rounds.filter(
    r =>
      r.status === 'COMPLETE' && !r.deletedAt && inPeriod(r.roundDate, period)
  );
  const ids = new Set(done.map(r => r.id));
  const inRounds = harvests.filter(
    h => valid(h) && h.roundId && ids.has(h.roundId)
  );
  const total = done.reduce((s, r) => s + (r.totalNuts ?? 0), 0);
  const treeNuts = inRounds.reduce((s, h) => s + (h.quantity ?? 0), 0);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    rounds: done.length,
    totalNuts: total,
    avgTreesPerRound: done.length ? r1(inRounds.length / done.length) : null,
    avgNutsPerRound: done.length ? r1(total / done.length) : null,
    avgNutsPerTree: inRounds.length ? r1(treeNuts / inRounds.length) : null,
  };
}

/** CALC-009: sample sizes in a period; the denominator is SAMPLES. */
export function sampleDistribution(
  samples: readonly ASample[],
  period: Period
) {
  const counts: Record<SizeClass, number> = {
    SMALL: 0,
    MEDIUM: 0,
    LARGE: 0,
    UNCLASSIFIED: 0,
  };
  let total = 0;
  for (const s of samples) {
    if (s.deletedAt || !inPeriod(s.sampledAt, period)) continue;
    counts[s.sizeClass] += 1;
    total += 1;
  }
  return { counts, samples: total };
}

/** Days without a record before a producing tree is listed as "no recent record". */
export const NO_RECENT_RECORD_DAYS = 90;

export type Insight =
  | { kind: 'TOP_AVERAGE'; code: string; average: number; harvests: number }
  | {
      kind: 'OVERDUE_VS_MEDIAN';
      code: string;
      days: number;
      medianInterval: number;
    }
  | { kind: 'NO_RECENT_RECORD'; code: string; days: number | null };

/**
 * §17.6 facts, worded by the client: "C-014 averaged 22 coconuts over its last
 * 4 recorded pluckings", "C-014 has not been plucked for 71 days. Its median
 * recorded interval is 62 days." Never "poor", never a diagnosis.
 */
export function coconutInsights(
  stats: readonly TreeStats[],
  limit = 3
): Insight[] {
  const producing = stats.filter(s => s.status === 'PRODUCING');
  const top = producing
    .filter(s => s.average != null && s.harvestCount >= 3)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
    .slice(0, limit)
    .map(
      (s): Insight => ({
        kind: 'TOP_AVERAGE',
        code: s.code,
        average: s.average ?? 0,
        harvests: s.harvestCount,
      })
    );
  const overdue = producing
    .filter(
      s =>
        s.medianInterval != null &&
        s.daysSinceLast != null &&
        s.daysSinceLast > s.medianInterval
    )
    .sort(
      (a, b) =>
        (b.daysSinceLast ?? 0) -
        (b.medianInterval ?? 0) -
        ((a.daysSinceLast ?? 0) - (a.medianInterval ?? 0))
    )
    .slice(0, limit)
    .map(
      (s): Insight => ({
        kind: 'OVERDUE_VS_MEDIAN',
        code: s.code,
        days: s.daysSinceLast ?? 0,
        medianInterval: s.medianInterval ?? 0,
      })
    );
  const quiet = producing
    .filter(
      s => s.daysSinceLast == null || s.daysSinceLast > NO_RECENT_RECORD_DAYS
    )
    .filter(s => !overdue.some(o => o.code === s.code))
    .slice(0, limit)
    .map(
      (s): Insight => ({
        kind: 'NO_RECENT_RECORD',
        code: s.code,
        days: s.daysSinceLast,
      })
    );
  return [...top, ...overdue, ...quiet];
}

// ─── Sales (§17.3, CALC-014) ──────────────────────────────────────────────────

export interface ASale {
  saleDate: string;
  buyerId?: string | null;
  buyerName?: string | null;
  cropCode?: string | null;
  quantityUnit?: string | null;
  totalQuantity: number;
  calculatedAmount: number;
  actualAmountReceived?: number | null;
  lines: { sizeClass?: string | null; quantity: number; lineAmount: number }[];
  deletedAt?: string | null;
}

const cents = (n: number) => Math.round(n * 100);
const money = (c: number) => c / 100;

export interface SalesSummary {
  sales: number;
  calculated: number;
  /** Σ actual where entered */
  actual: number;
  /** actual − calculated over sales WITH an actual amount */
  difference: number;
  salesWithActual: number;
  byMonth: {
    month: string;
    calculated: number;
    actual: number;
    quantity: number;
  }[];
  byBuyer: {
    buyer: string;
    sales: number;
    quantity: number;
    actual: number;
    calculated: number;
  }[];
  byCrop: {
    cropCode: string;
    unit: string;
    quantity: number;
    calculated: number;
  }[];
  /** coconut quantities by recorded line size (no size = "ANY") */
  bySize: { sizeClass: string; quantity: number; amount: number }[];
  /**
   * CALC-014: Σ actual ÷ Σ nuts, ONLY over coconut sales with an actual amount
   * in the period; null when there are none. The scope travels with it.
   */
  realizedPerCoconut: { value: number; sales: number; nuts: number } | null;
}

export function salesSummary(
  all: readonly ASale[],
  period: Period
): SalesSummary {
  const sales = all.filter(s => !s.deletedAt && inPeriod(s.saleDate, period));
  const withActual = sales.filter(s => s.actualAmountReceived != null);
  const months = new Map(
    monthsIn(period).map(m => [
      m,
      { month: m, calculatedC: 0, actualC: 0, quantity: 0 },
    ])
  );
  const buyers = new Map<
    string,
    {
      buyer: string;
      sales: number;
      quantity: number;
      actualC: number;
      calculatedC: number;
    }
  >();
  const crops = new Map<
    string,
    { cropCode: string; unit: string; quantity: number; calculatedC: number }
  >();
  const sizes = new Map<
    string,
    { sizeClass: string; quantity: number; amountC: number }
  >();
  for (const s of sales) {
    const m = months.get(monthOf(s.saleDate));
    if (m) {
      m.calculatedC += cents(s.calculatedAmount);
      m.actualC += cents(s.actualAmountReceived ?? 0);
      m.quantity = roundQty(m.quantity + s.totalQuantity);
    }
    const bk = s.buyerId ?? '';
    const b = buyers.get(bk) ?? {
      buyer: s.buyerName ?? '',
      sales: 0,
      quantity: 0,
      actualC: 0,
      calculatedC: 0,
    };
    b.sales += 1;
    b.quantity = roundQty(b.quantity + s.totalQuantity);
    b.actualC += cents(s.actualAmountReceived ?? 0);
    b.calculatedC += cents(s.calculatedAmount);
    buyers.set(bk, b);
    const crop = s.cropCode ?? 'COCONUT';
    const unit = s.quantityUnit ?? 'NUT';
    const ck = `${crop}#${unit}`;
    const c = crops.get(ck) ?? {
      cropCode: crop,
      unit,
      quantity: 0,
      calculatedC: 0,
    };
    c.quantity = roundQty(c.quantity + s.totalQuantity);
    c.calculatedC += cents(s.calculatedAmount);
    crops.set(ck, c);
    if (crop === 'COCONUT')
      for (const l of s.lines) {
        const k = l.sizeClass ?? 'ANY';
        const z = sizes.get(k) ?? { sizeClass: k, quantity: 0, amountC: 0 };
        z.quantity += l.quantity;
        z.amountC += cents(l.lineAmount);
        sizes.set(k, z);
      }
  }
  const coconutActual = withActual.filter(
    s => (s.cropCode ?? 'COCONUT') === 'COCONUT'
  );
  const nuts = coconutActual.reduce((n, s) => n + s.totalQuantity, 0);
  const actualC = withActual.reduce(
    (n, s) => n + cents(s.actualAmountReceived ?? 0),
    0
  );
  const calcWithActualC = withActual.reduce(
    (n, s) => n + cents(s.calculatedAmount),
    0
  );
  return {
    sales: sales.length,
    calculated: money(sales.reduce((n, s) => n + cents(s.calculatedAmount), 0)),
    actual: money(actualC),
    difference: money(actualC - calcWithActualC),
    salesWithActual: withActual.length,
    byMonth: [...months.values()].map(m => ({
      month: m.month,
      calculated: money(m.calculatedC),
      actual: money(m.actualC),
      quantity: m.quantity,
    })),
    byBuyer: [...buyers.values()]
      .map(b => ({
        buyer: b.buyer,
        sales: b.sales,
        quantity: b.quantity,
        actual: money(b.actualC),
        calculated: money(b.calculatedC),
      }))
      .sort((a, b) => b.calculated - a.calculated),
    byCrop: [...crops.values()].map(c => ({
      cropCode: c.cropCode,
      unit: c.unit,
      quantity: c.quantity,
      calculated: money(c.calculatedC),
    })),
    bySize: [...sizes.values()]
      .map(z => ({
        sizeClass: z.sizeClass,
        quantity: z.quantity,
        amount: money(z.amountC),
      }))
      .sort((a, b) => b.quantity - a.quantity),
    realizedPerCoconut:
      nuts > 0
        ? {
            value: money(
              Math.round(
                coconutActual.reduce(
                  (n, s) => n + cents(s.actualAmountReceived ?? 0),
                  0
                ) / nuts
              )
            ),
            sales: coconutActual.length,
            nuts,
          }
        : null,
  };
}

// ─── Stock (§17.4) & polytunnel (§17.5) ───────────────────────────────────────

export interface ATxn {
  transactionType: string;
  quantity: number;
  transactionDate: string;
  unit?: string | null;
  cropCode?: string | null;
}

/** Use, damage, waste and adjustments in the period, per type + crop + unit. */
export function stockAdjustments(txns: readonly ATxn[], period: Period) {
  const types = new Set([
    'HOUSEHOLD_USE',
    'DAMAGE',
    'WASTE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
  ]);
  const map = new Map<
    string,
    {
      transactionType: string;
      cropCode: string;
      unit: string;
      quantity: number;
      count: number;
    }
  >();
  for (const t of txns) {
    if (!types.has(t.transactionType) || !inPeriod(t.transactionDate, period))
      continue;
    const crop = t.cropCode ?? 'COCONUT';
    const unit = t.unit ?? 'NUT';
    const k = `${t.transactionType}#${crop}#${unit}`;
    const e = map.get(k) ?? {
      transactionType: t.transactionType,
      cropCode: crop,
      unit,
      quantity: 0,
      count: 0,
    };
    e.quantity = roundQty(e.quantity + t.quantity);
    e.count += 1;
    map.set(k, e);
  }
  return [...map.values()];
}

export interface ACropHarvest {
  cropCode: string;
  cropName?: string | null;
  harvestDate: string;
  quantity: number;
  unit: string;
  deletedAt?: string | null;
}

/** §17.5: harvest quantity by crop, unit and month. */
export function cropHarvests(
  harvests: readonly ACropHarvest[],
  period: Period
) {
  const months = monthsIn(period);
  const map = new Map<
    string,
    {
      cropCode: string;
      cropName: string;
      unit: string;
      total: number;
      byMonth: Record<string, number>;
    }
  >();
  for (const h of harvests) {
    if (h.deletedAt || !inPeriod(h.harvestDate, period)) continue;
    const k = `${h.cropCode}#${h.unit}`;
    const e = map.get(k) ?? {
      cropCode: h.cropCode,
      cropName: h.cropName ?? h.cropCode,
      unit: h.unit,
      total: 0,
      byMonth: Object.fromEntries(months.map(m => [m, 0])),
    };
    e.total = roundQty(e.total + h.quantity);
    const m = monthOf(h.harvestDate);
    if (m in e.byMonth)
      e.byMonth[m] = roundQty((e.byMonth[m] ?? 0) + h.quantity);
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => a.cropName.localeCompare(b.cropName));
}
