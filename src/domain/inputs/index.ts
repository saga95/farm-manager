/**
 * Farm-input inventory (SRS §12, #80, #81): fertiliser, treatments, seeds,
 * grow bags, potting media, irrigation parts, tools. Completely separate from
 * produce stock (AC-IN-005). Quantity is ALWAYS the sum of transactions.
 * V1 is tracking only: no purchase orders, no accounting.
 */

export const INPUT_CATEGORIES = [
  'FERTILIZER',
  'TREATMENT',
  'SEED',
  'GROW_BAG',
  'POTTING_MEDIA',
  'IRRIGATION',
  'TOOLS',
  'OTHER',
] as const;
export type InputCategory = (typeof INPUT_CATEGORIES)[number];

export const INPUT_UNITS = [
  'KG',
  'G',
  'L',
  'ML',
  'PIECE',
  'BAG',
  'PACKET',
  'M',
] as const;
export type InputUnit = (typeof INPUT_UNITS)[number];

export const INPUT_TXN_TYPES = ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT'] as const;
export type InputTxnType = (typeof INPUT_TXN_TYPES)[number];

export const INPUT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export interface InputTxn {
  type: InputTxnType;
  /** STOCK_IN / STOCK_OUT: positive amount. ADJUSTMENT: signed change. */
  quantity: number;
}

/** Quantities are kept to 3 decimals (kg / L), avoiding float drift. */
export const roundQty = (n: number) => Math.round(n * 1000) / 1000;

/** Signed effect of one transaction on stock. */
export function signedQuantity(t: InputTxn): number {
  if (t.type === 'STOCK_OUT') return -Math.abs(t.quantity);
  if (t.type === 'STOCK_IN') return Math.abs(t.quantity);
  return t.quantity;
}

/** Current quantity = Σ signed transactions. */
export function inputBalance(txns: readonly InputTxn[]): number {
  return roundQty(txns.reduce((sum, t) => sum + signedQuantity(t), 0));
}

/** ADJUSTMENT changes reconciled stock, so it needs a reason (as AC-IN-004). */
export const inputReasonRequired = (type: InputTxnType) =>
  type === 'ADJUSTMENT';

/** Low stock when a reorder level is set and quantity is at or below it. */
export function isLowStock(
  quantity: number,
  reorderLevel?: number | null
): boolean {
  return reorderLevel != null && quantity <= reorderLevel;
}

export class InputStockError extends Error {
  constructor(public readonly available: number) {
    super(`Only ${available} in stock`);
    this.name = 'InputStockError';
  }
}

/** Apply a movement to the current quantity; never below zero. */
export function applyInputTxn(current: number, t: InputTxn): number {
  const next = roundQty(current + signedQuantity(t));
  if (next < 0) throw new InputStockError(current);
  return next;
}
