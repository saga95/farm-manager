/**
 * Buyers and sales (SRS §13, CALC-011..013, DQ-009, AC-SL-001..006).
 *
 * Money is computed in integer minor units (cents) to avoid float drift, then
 * returned as numbers with 2 decimals. The calculated amount (Σ lines) and the
 * actual amount received are ALWAYS kept separately; neither overwrites the
 * other, and the difference is preserved with an optional reason.
 */

import { type ProduceState, type StockByState, roundQty } from '../inventory';
import { CLASSIFIED_SIZES, type ClassifiedSize } from '../samples';

export const BUYER_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

/**
 * §13.2: preferences belong to the Buyer record and are editable; a buyer
 * type never implies a size. A size can't be both preferred and merely
 * acceptable; duplicates are removed and order follows SMALL → LARGE.
 */
export function normalizeSizePrefs(
  preferred: readonly string[],
  acceptable: readonly string[]
): { preferredSizes: ClassifiedSize[]; acceptableSizes: ClassifiedSize[] } {
  const valid = (s: string): s is ClassifiedSize =>
    (CLASSIFIED_SIZES as readonly string[]).includes(s);
  const pref = new Set(preferred.filter(valid));
  const acc = new Set(acceptable.filter(valid).filter(s => !pref.has(s)));
  return {
    preferredSizes: CLASSIFIED_SIZES.filter(s => pref.has(s)),
    acceptableSizes: CLASSIFIED_SIZES.filter(s => acc.has(s)),
  };
}

// ─── Money ────────────────────────────────────────────────────────────────────

export const toCents = (amount: number) => Math.round(amount * 100);
export const fromCents = (cents: number) => cents / 100;

export interface SaleLineInput {
  /** Optional: SMALL / MEDIUM / LARGE / UNCLASSIFIED or none (§13.4) */
  sizeClass?: string | null;
  quantity: number;
  unitPrice: number;
}

/** CALC-011: line amount = quantity × unit price. */
export function lineAmount(line: SaleLineInput): number {
  // Quantities may be decimal (12.5 kg): round the line to whole cents
  return fromCents(Math.round(line.quantity * toCents(line.unitPrice)));
}

/** CALC-012: calculated sale amount = Σ line amounts. */
export function calculatedAmount(lines: readonly SaleLineInput[]): number {
  return fromCents(
    lines.reduce(
      (sum, l) => sum + Math.round(l.quantity * toCents(l.unitPrice)),
      0
    )
  );
}

export function totalQuantity(lines: readonly SaleLineInput[]): number {
  return roundQty(lines.reduce((sum, l) => sum + l.quantity, 0));
}

/**
 * CALC-013 / DQ-009: actual received is user-entered and never replaces the
 * calculated amount. difference = actual − calculated (null when no actual).
 */
export function saleTotals(
  lines: readonly SaleLineInput[],
  actualAmountReceived?: number | null
) {
  const calculated = calculatedAmount(lines);
  const actual = actualAmountReceived ?? null;
  return {
    totalQuantity: totalQuantity(lines),
    calculatedAmount: calculated,
    actualAmountReceived: actual,
    difference:
      actual === null ? null : fromCents(toCents(actual) - toCents(calculated)),
  };
}

// ─── Stock allocation (§13.5) ─────────────────────────────────────────────────

export type StockState = ProduceState;

export interface Allocation {
  batchId: string;
  state: StockState;
  quantity: number;
}

/** Merge allocations for the same batch + state; drop zeros. */
export function mergeAllocations(allocs: readonly Allocation[]): Allocation[] {
  const map = new Map<string, Allocation>();
  for (const a of allocs) {
    const k = `${a.batchId}#${a.state}`;
    const prev = map.get(k);
    map.set(k, {
      ...a,
      quantity: roundQty((prev?.quantity ?? 0) + a.quantity),
    });
  }
  return [...map.values()].filter(a => a.quantity !== 0);
}

/**
 * Per batch+state change in stock-out between an old and a new allocation
 * (edit reconciliation, #88). Positive = more nuts leave stock.
 */
export function allocationDelta(
  before: readonly Allocation[],
  after: readonly Allocation[]
): Allocation[] {
  const neg = before.map(a => ({ ...a, quantity: -a.quantity }));
  return mergeAllocations([...after, ...neg]);
}

export type SaleProblem =
  | { code: 'NO_LINES' }
  | { code: 'ALLOCATION_MISMATCH'; sold: number; allocated: number };

/** Every sold nut must come from a selected batch/state (§13.5). */
export function validateSale(
  lines: readonly SaleLineInput[],
  allocations: readonly Allocation[]
): SaleProblem | null {
  if (lines.length === 0 || totalQuantity(lines) <= 0)
    return { code: 'NO_LINES' };
  const sold = totalQuantity(lines);
  const allocated = roundQty(allocations.reduce((s, a) => s + a.quantity, 0));
  if (sold !== allocated)
    return { code: 'ALLOCATION_MISMATCH', sold, allocated };
  return null;
}

export interface BatchStock {
  batchId: string;
  batchDate: string;
  available: StockByState;
}

/**
 * Suggest where sold nuts come from: oldest stock first (FIFO) in the chosen
 * state. Returns what it could cover; `short` > 0 means not enough stock.
 */
export function autoAllocate(
  quantity: number,
  batches: readonly BatchStock[],
  state: StockState
): { allocations: Allocation[]; short: number } {
  let left = quantity;
  const allocations: Allocation[] = [];
  for (const b of [...batches].sort((x, y) =>
    x.batchDate.localeCompare(y.batchDate)
  )) {
    if (left <= 0) break;
    const take = Math.min(left, b.available[state] ?? 0);
    if (take > 0) {
      allocations.push({ batchId: b.batchId, state, quantity: take });
      left -= take;
    }
  }
  return { allocations, short: Math.max(0, left) };
}
