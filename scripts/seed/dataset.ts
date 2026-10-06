/**
 * Validation dataset (#24, SRS §33). Built only through the app's own API
 * (src/lib/api.ts) as a signed-in user, so it obeys every rule a real user
 * does, needs no AWS write access, and works the same on dev and in tests.
 *
 * Repeatable: every id is derived from the user and a fixed key, and every
 * date is a fixed calendar date in 2026. Running it again skips what already
 * exists ("Id already in use") and creates only what is missing.
 *
 * Tenant A: farm, Coconut Area + Polytunnel, 50 trees, 6 past rounds with
 * samples, 3 buyers, 6 sales, 3 farm inputs, an active polytunnel cycle with
 * activities and harvests. Tenant B: a small separate farm whose tree codes
 * overlap A's (C-001…), for isolation checks.
 */

import { createHash } from 'node:crypto';
import * as api from '../../src/lib/api';
import { ApiError } from '../../src/lib/api';

export type SeedTenant = 'A' | 'B';

export interface SeedOptions {
  tenant: SeedTenant;
  /** The signed-in user's id: keeps ids unique per person seeding. */
  userId: string;
  log?: (line: string) => void;
}

export interface SeedResult {
  tenantId: string;
  farmId: string;
  /** Steps that ran (a replay of an existing record also counts here). */
  applied: number;
  /** Steps skipped because the record already exists. */
  skipped: number;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A valid ULID-format id, the same every time for the same inputs. */
export function seedId(userId: string, key: string): string {
  const bytes = createHash('sha256').update(`${userId}|${key}`).digest();
  let out = '01'; // timestamp prefix in range
  for (let i = 0; out.length < 26; i += 1)
    out += CROCKFORD[(bytes[i] ?? 0) % 32];
  return out;
}

/** Small deterministic PRNG (mulberry32) so counts look real but never change. */
function prng(seed: string): () => number {
  let a = createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;

interface Plan {
  name: string;
  farmName: string;
  trees: number;
  /** Past plucking rounds (fixed dates, oldest first). */
  rounds: string[];
  /** Rounds whose nuts are still in stock (the rest were sold long ago). */
  inStockRounds: number;
  /** Rounds that were sampled (the latest ones). */
  sampledRounds: number;
  polytunnel: boolean;
  buyers: {
    key: string;
    name: string;
    preferred: string[];
    acceptable: string[];
  }[];
  sales: {
    key: string;
    date: string;
    buyer: string;
    lines: [string, number, number][];
  }[];
  inputs: boolean;
}

const PLANS: Record<SeedTenant, Plan> = {
  A: {
    name: 'Validation Farm A',
    farmName: 'Home farm',
    trees: 50,
    rounds: [
      '2026-01-12',
      '2026-02-23',
      '2026-04-06',
      '2026-05-18',
      '2026-06-29',
      '2026-08-10',
      '2026-09-21',
    ],
    inStockRounds: 2,
    sampledRounds: 3,
    polytunnel: true,
    buyers: [
      {
        key: 'restaurant',
        name: 'Lagoon Restaurant',
        preferred: ['MEDIUM'],
        acceptable: ['SMALL'],
      },
      {
        key: 'wholesale',
        name: 'Negombo Wholesale',
        preferred: [],
        acceptable: ['SMALL', 'MEDIUM', 'LARGE'],
      },
      {
        key: 'shop',
        name: 'Village Shop',
        preferred: ['LARGE'],
        acceptable: ['MEDIUM'],
      },
    ],
    sales: [
      {
        key: 's1',
        date: '2026-01-15',
        buyer: 'wholesale',
        lines: [
          ['MEDIUM', 300, 95],
          ['SMALL', 120, 80],
        ],
      },
      {
        key: 's2',
        date: '2026-02-26',
        buyer: 'restaurant',
        lines: [['MEDIUM', 150, 110]],
      },
      {
        key: 's3',
        date: '2026-04-09',
        buyer: 'wholesale',
        lines: [
          ['MEDIUM', 280, 95],
          ['LARGE', 90, 120],
        ],
      },
      {
        key: 's4',
        date: '2026-05-21',
        buyer: 'shop',
        lines: [['LARGE', 120, 125]],
      },
      {
        key: 's5',
        date: '2026-07-02',
        buyer: 'restaurant',
        lines: [['MEDIUM', 180, 115]],
      },
      {
        key: 's6',
        date: '2026-08-13',
        buyer: 'wholesale',
        lines: [
          ['MEDIUM', 260, 100],
          ['SMALL', 100, 85],
        ],
      },
    ],
    inputs: true,
  },
  B: {
    name: 'Validation Farm B',
    farmName: 'Hill block',
    trees: 10,
    rounds: ['2026-07-06', '2026-08-24'],
    inStockRounds: 1,
    sampledRounds: 1,
    polytunnel: false,
    buyers: [
      {
        key: 'trader',
        name: 'Kandy Trader',
        preferred: ['LARGE'],
        acceptable: ['MEDIUM'],
      },
    ],
    sales: [
      {
        key: 's1',
        date: '2026-07-10',
        buyer: 'trader',
        lines: [['LARGE', 80, 120]],
      },
    ],
    inputs: false,
  },
};

export async function seed(opts: SeedOptions): Promise<SeedResult> {
  const plan = PLANS[opts.tenant];
  const log = opts.log ?? (() => undefined);
  const id = (key: string) => seedId(opts.userId, `${opts.tenant}:${key}`);
  const tenantId = id('tenant');
  const farmId = id('farm');
  const stats = { applied: 0, skipped: 0 };

  /** Run a create; an id that already exists means an earlier run made it. */
  async function step(label: string, create: () => Promise<unknown>) {
    try {
      await create();
      stats.applied += 1;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        stats.skipped += 1;
        return;
      }
      throw new Error(
        `${label}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // ── Tenant, farm, zones, polytunnel space ──────────────────────────────────
  const t = await api.createTenant({
    tenantId,
    name: plan.name,
    defaultTimezone: 'Asia/Colombo',
    defaultCurrency: 'LKR',
    defaultLocale: 'en',
    farmId,
    farmName: plan.farmName,
  });
  stats[t.replayed ? 'skipped' : 'applied'] += 1;
  log(
    `${opts.tenant}: tenant ${tenantId} (${t.replayed ? 'exists' : 'created'})`
  );

  const coconutZone = id('zone:coconut');
  await step('coconut zone', () =>
    api.createZone(tenantId, farmId, coconutZone, {
      name: 'Coconut Area',
      zoneType: 'COCONUT_AREA',
    })
  );
  const tunnelZone = id('zone:polytunnel');
  const tunnelSpace = id('space:polytunnel');
  if (plan.polytunnel) {
    await step('polytunnel zone', () =>
      api.createZone(tenantId, farmId, tunnelZone, {
        name: 'Polytunnel',
        zoneType: 'POLYTUNNEL',
      })
    );
    await step('polytunnel space', () =>
      api.createSpace(tenantId, farmId, tunnelSpace, {
        name: 'Tunnel 1',
        spaceType: 'POLYTUNNEL',
        parentZoneId: tunnelZone,
      })
    );
  }

  // ── Trees C-001… (bulk, only on a fresh farm) ──────────────────────────────
  let trees = await api.listTrees(tenantId, farmId);
  if (trees.length < plan.trees) {
    await step('trees', () =>
      api.bulkCreateTrees(tenantId, farmId, {
        prefix: 'C',
        start: trees.length + 1,
        count: plan.trees - trees.length,
        width: 3,
        status: 'PRODUCING',
        zoneId: coconutZone,
      })
    );
    trees = await api.listTrees(tenantId, farmId);
  }
  trees = [...trees].sort((a, b) => a.code.localeCompare(b.code));
  log(`${opts.tenant}: ${trees.length} trees`);

  // ── Past rounds (backfill), each tree has its own typical yield ───────────
  const typical = new Map(
    trees.map(tree => [tree.id, 6 + Math.floor(prng(`${tree.code}`)() * 18)])
  );
  const harvests: {
    roundIndex: number;
    treeCode: string;
    harvestId: string;
  }[] = [];
  for (const [ri, date] of plan.rounds.entries()) {
    const rand = prng(`${opts.tenant}:${date}`);
    const entries = trees
      .filter(() => rand() > 0.1) // a few trees are skipped each round
      .map(tree => {
        const base = typical.get(tree.id) ?? 10;
        const quantity = Math.max(0, Math.round(base * (0.7 + rand() * 0.6)));
        const harvestId = id(`harvest:${date}:${tree.code}`);
        harvests.push({ roundIndex: ri, treeCode: tree.code, harvestId });
        return { treeId: tree.id, harvestId, quantity, approximate: false };
      });
    await step(`round ${date}`, () =>
      api.backfillRound(tenantId, farmId, {
        roundId: id(`round:${date}`),
        roundDate: date,
        source: 'MANUAL_BACKFILL',
        entries,
        unattributedQuantity: null,
        approximate: false,
        excludeFromPrediction: false,
        addToStock: ri >= plan.rounds.length - plan.inStockRounds,
        notes: 'Validation dataset (#24)',
      })
    );
  }
  log(`${opts.tenant}: ${plan.rounds.length} rounds`);

  // ── Dehusked samples on the latest rounds (each tree leans to a size) ──────
  const firstSampled = plan.rounds.length - plan.sampledRounds;
  for (const h of harvests.filter(x => x.roundIndex >= firstSampled)) {
    const lean = Math.floor(prng(`size:${h.treeCode}`)() * 3);
    const r = prng(`sample:${h.harvestId}`)();
    const size =
      SIZES[Math.min(2, Math.max(0, lean + (r < 0.2 ? -1 : r > 0.8 ? 1 : 0)))];
    await step(`sample ${h.treeCode}`, () =>
      api.recordCoconutSample(tenantId, {
        harvestId: h.harvestId,
        sampleId: id(`sample:${h.harvestId}`),
        sizeClass: size ?? 'MEDIUM',
        weight: null,
        notes: null,
      })
    );
  }

  // ── Buyers and past sales ──────────────────────────────────────────────────
  for (const b of plan.buyers)
    await step(`buyer ${b.name}`, () =>
      api.createBuyer(tenantId, id(`buyer:${b.key}`), {
        name: b.name,
        contactName: '',
        phone: '',
        preferredSizes: b.preferred,
        acceptableSizes: b.acceptable,
        requirementNote: '',
        notes: '',
      })
    );
  for (const s of plan.sales)
    await step(`sale ${s.date}`, () =>
      api.backfillSale(tenantId, {
        farmId,
        saleId: id(`sale:${s.key}`),
        saleDate: s.date,
        source: 'MANUAL_BACKFILL',
        buyerId: id(`buyer:${s.buyer}`),
        lines: s.lines.map(([sizeClass, quantity, unitPrice]) => ({
          sizeClass,
          quantity,
          unitPrice,
        })),
        actualAmountReceived: null,
        differenceReason: null,
        notes: 'Validation dataset (#24)',
      })
    );
  log(
    `${opts.tenant}: ${plan.buyers.length} buyers, ${plan.sales.length} sales`
  );

  // ── Farm inputs ────────────────────────────────────────────────────────────
  const fertilizer = id('input:fertilizer');
  if (plan.inputs) {
    const items: [string, string, string, string, number][] = [
      ['fertilizer', 'Coconut fertilizer mix', 'FERTILIZER', 'KG', 100],
      ['fungicide', 'Copper fungicide', 'TREATMENT', 'L', 5],
      ['growbags', 'Grow bags (large)', 'GROW_BAG', 'PIECE', 60],
    ];
    for (const [key, name, category, unit, opening] of items)
      await step(`input ${name}`, () =>
        api.createInputItem(tenantId, {
          farmId,
          itemId: id(`input:${key}`),
          name,
          category,
          unit,
          reorderLevel: Math.round(opening / 5),
          notes: null,
          openingQuantity: opening,
          openingDate: '2026-01-05',
        })
      );
    await step('fertilizer use', () =>
      api.recordInputMovement(tenantId, {
        itemId: fertilizer,
        operationId: id('input-move:fertilizer:1'),
        transactionType: 'STOCK_OUT',
        quantity: 25,
        decrease: true,
        transactionDate: '2026-03-02',
        reason: 'Applied to coconut area',
        notes: null,
      })
    );
    log(`${opts.tenant}: ${items.length} farm inputs`);
  }

  // ── Polytunnel cycle with activities and harvests ──────────────────────────
  if (plan.polytunnel) {
    const cycleId = id('cycle:chilli');
    await step('cycle', () =>
      api.createCycle(tenantId, {
        farmId,
        cycleId,
        status: 'ACTIVE',
        name: 'Chilli, tunnel 1',
        cropName: 'Chilli',
        variety: 'MI-2',
        zoneId: tunnelZone,
        growingSpaceId: tunnelSpace,
        plantedAt: '2026-07-01',
        expectedEndAt: '2026-12-31',
        estimatedPlantCount: 120,
        areaUsed: null,
        areaUnit: null,
        notes: 'Validation dataset (#24)',
      })
    );
    const activities: [string, string, string][] = [
      ['planting', 'PLANTING', '2026-07-01'],
      ['water-1', 'WATERING', '2026-07-08'],
      ['fert-1', 'FERTILIZER', '2026-08-01'],
      ['pest-1', 'PEST_OR_DISEASE_OBSERVATION', '2026-08-20'],
    ];
    for (const [key, activityType, activityDate] of activities)
      await step(`activity ${key}`, () =>
        api.recordActivity(tenantId, {
          activityId: id(`activity:${key}`),
          targetId: cycleId,
          activityType,
          activityDate,
          notes: null,
          quantity: null,
          unit: null,
          materialName: null,
          inputItemId: null,
        })
      );
    for (const [key, harvestDate, quantity] of [
      ['h1', '2026-09-08', 4.5],
      ['h2', '2026-09-22', 6.25],
    ] as const)
      await step(`cycle harvest ${key}`, () =>
        api.recordCycleHarvest(tenantId, {
          cycleId,
          harvestId: id(`cycle-harvest:${key}`),
          harvestDate,
          quantity,
          unit: 'KG',
          qualityNote: null,
          notes: null,
        })
      );
    log(
      `${opts.tenant}: polytunnel cycle, ${activities.length} activities, 2 harvests`
    );
  }

  return { tenantId, farmId, ...stats };
}
