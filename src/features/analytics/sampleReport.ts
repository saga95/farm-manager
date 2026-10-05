/** A realistic report for stories and tests (no network). */

import type { AnalyticsReport } from '@/lib/api';

const months = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
];
const nuts = [310, 0, 420, 0, 385, 0];
const sizeCounts = (l: number, m: number, s: number) => ({
  SMALL: s,
  MEDIUM: m,
  LARGE: l,
  UNCLASSIFIED: 0,
});

export const sampleReport: AnalyticsReport = {
  period: { from: '2026-01-01', to: '2026-06-30' },
  generatedAt: '2026-06-30T10:00:00.000Z',
  includeNonProducing: false,
  coconut: {
    totals: {
      nuts: 1115,
      harvestRecords: 54,
      avgPerHarvest: 20.6,
      producingTrees: 34,
      trees: 50,
    },
    byMonth: months.map((month, i) => ({
      month,
      value: nuts[i] ?? 0,
      count: (nuts[i] ?? 0) > 0 ? 18 : 0,
    })),
    rounds: {
      rounds: 3,
      totalNuts: 1115,
      avgTreesPerRound: 18,
      avgNutsPerRound: 371.7,
      avgNutsPerTree: 20.6,
    },
    samples: { counts: sizeCounts(22, 25, 7), samples: 54 },
    trees: [
      {
        treeId: 't14',
        code: 'C-014',
        status: 'PRODUCING',
        periodNuts: 66,
        periodHarvests: 3,
        lifetimeNuts: 88,
        harvestCount: 4,
        average: 22,
        best: 24,
        lastPlucked: '2026-05-10',
        daysSinceLast: 51,
        medianInterval: 61,
        latestSampleSize: 'LARGE',
        sizeCounts: sizeCounts(3, 1, 0),
        sampleCount: 4,
        nextEstimate: '2026-07-10',
      },
      {
        treeId: 't20',
        code: 'C-020',
        status: 'PRODUCING',
        periodNuts: 0,
        periodHarvests: 0,
        lifetimeNuts: 0,
        harvestCount: 0,
        average: null,
        best: null,
        lastPlucked: null,
        daysSinceLast: null,
        medianInterval: null,
        latestSampleSize: null,
        sizeCounts: sizeCounts(0, 0, 0),
        sampleCount: 0,
        nextEstimate: null,
      },
    ],
    insights: [
      { kind: 'TOP_AVERAGE', code: 'C-014', average: 22, harvests: 4 },
      {
        kind: 'OVERDUE_VS_MEDIAN',
        code: 'C-031',
        days: 71,
        medianInterval: 62,
      },
      { kind: 'NO_RECENT_RECORD', code: 'C-020', days: null },
    ],
  },
  sales: {
    sales: 6,
    calculated: 54200,
    actual: 52500,
    difference: -1200,
    salesWithActual: 5,
    byMonth: months.map((month, i) => ({
      month,
      calculated: [9800, 4200, 12500, 8000, 14700, 5000][i] ?? 0,
      actual: 0,
      quantity: 0,
    })),
    byBuyer: [
      {
        buyer: 'Lake View Restaurant',
        sales: 3,
        quantity: 190,
        actual: 24000,
        calculated: 24800,
      },
      { buyer: '', sales: 1, quantity: 30, actual: 3600, calculated: 3600 },
    ],
    byCrop: [
      { cropCode: 'COCONUT', unit: 'NUT', quantity: 420, calculated: 49160 },
      { cropCode: 'CUCUMBER', unit: 'KG', quantity: 10.5, calculated: 5040 },
    ],
    bySize: [
      { sizeClass: 'MEDIUM', quantity: 210, amount: 25200 },
      { sizeClass: 'LARGE', quantity: 150, amount: 21000 },
    ],
    realizedPerCoconut: { value: 117.5, sales: 4, nuts: 400 },
  },
  stock: {
    current: [
      {
        cropCode: 'COCONUT',
        cropName: 'COCONUT',
        unit: 'NUT',
        byState: { HUSKED: 90, DEHUSKED: 26 },
        total: 116,
      },
      {
        cropCode: 'CUCUMBER',
        cropName: 'Cucumber',
        unit: 'KG',
        byState: { FRESH: 2 },
        total: 2,
      },
    ],
    adjustments: [
      {
        transactionType: 'HOUSEHOLD_USE',
        cropCode: 'COCONUT',
        unit: 'NUT',
        quantity: 12,
        count: 3,
      },
    ],
    inputs: 4,
    lowStock: [
      { id: 'i1', name: 'Urea', quantity: 2, unit: 'KG', reorderLevel: 5 },
    ],
  },
  crops: [
    {
      cropCode: 'CUCUMBER',
      cropName: 'Cucumber',
      unit: 'KG',
      total: 20.75,
      byMonth: Object.fromEntries(
        months.map((m, i) => [m, i === 3 ? 20.75 : 0])
      ),
    },
  ],
};
