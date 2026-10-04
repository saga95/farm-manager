/**
 * Produce inventory rules (SRS §11, §41.9, §41.10, CALC-010, ADR-0004).
 * Stock is ALWAYS the sum of transactions; cached balances on a batch must be
 * reconcilable with `balance()`.
 */

export const PRODUCE_STATES = ['HUSKED', 'DEHUSKED', 'FRESH'] as const;
export type ProduceState = (typeof PRODUCE_STATES)[number];

/** Coconut stock is husked or dehusked (§41.9); other crops are just fresh. */
export const COCONUT_STATES = [
  'HUSKED',
  'DEHUSKED',
] as const satisfies readonly ProduceState[];
export const GENERIC_STATES = [
  'FRESH',
] as const satisfies readonly ProduceState[];
export function statesFor(cropCode: string): readonly ProduceState[] {
  return cropCode === 'COCONUT' ? COCONUT_STATES : GENERIC_STATES;
}

/** Available quantity per state; only the batch's own states are present. */
export type StockByState = Partial<Record<ProduceState, number>>;

/** Quantities keep 3 decimals (12.5 kg); nuts stay whole. */
export const roundQty = (n: number) => Math.round(n * 1000) / 1000;

export function stockTotal(byState: StockByState): number {
  return roundQty(
    Object.values(byState).reduce<number>((s, v) => s + (v ?? 0), 0)
  );
}

/** A batch's per-state balance with every state of its crop present. */
export function stockOf(
  cropCode: string,
  stored: StockByState | null | undefined
): StockByState {
  return Object.fromEntries(
    statesFor(cropCode).map(s => [s, stored?.[s] ?? 0])
  );
}

export const PRODUCE_TXN_TYPES = [
  'HARVEST_IN',
  'SALE_OUT',
  'HOUSEHOLD_USE',
  'DAMAGE',
  'WASTE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'PROCESSING',
] as const;
export type ProduceTxnType = (typeof PRODUCE_TXN_TYPES)[number];

const INBOUND: readonly ProduceTxnType[] = ['HARVEST_IN', 'ADJUSTMENT_IN'];

export interface ProduceTxn {
  type: ProduceTxnType;
  quantity: number;
  /** State the quantity enters/leaves; PROCESSING moves fromState → toState. */
  state?: ProduceState | undefined;
  fromState?: ProduceState | undefined;
  toState?: ProduceState | undefined;
}

export type Balance = { total: number; byState: StockByState };

/**
 * CALC-010: stock = Σ stock-in − Σ stock-out; PROCESSING conserves the total
 * (§41.9). `states` are the batch's states (coconut by default); the first is
 * used for transactions without a state.
 */
export function balance(
  txns: readonly ProduceTxn[],
  states: readonly ProduceState[] = COCONUT_STATES
): Balance {
  const byState: StockByState = Object.fromEntries(states.map(s => [s, 0]));
  const add = (s: ProduceState, d: number) => {
    byState[s] = roundQty((byState[s] ?? 0) + d);
  };
  for (const t of txns) {
    if (t.type === 'PROCESSING') {
      if (t.fromState && t.toState) {
        add(t.fromState, -t.quantity);
        add(t.toState, t.quantity);
      }
      continue;
    }
    add(
      t.state ?? states[0]!,
      INBOUND.includes(t.type) ? t.quantity : -t.quantity
    );
  }
  return { total: stockTotal(byState), byState };
}

/** Deterministic transaction ids: the same cause can apply at most once (ADR-0004 §2). */
export const txnIds = {
  roundHarvestIn: (roundId: string) => `HARVEST_IN#ROUND#${roundId}`,
  genericHarvestIn: (harvestId: string) => `HARVEST_IN#GH#${harvestId}`,
  saleOut: (saleId: string, batchId: string, state: ProduceState) =>
    `SALE_OUT#${saleId}#${batchId}#${state}`,
  dehusk: (clientOpId: string) => `DEHUSK#${clientOpId}`,
  adjustment: (clientOpId: string) => `ADJ#${clientOpId}`,
  reconcile: (entityId: string, version: number) =>
    `RECON#${entityId}#v${version}`,
} as const;

/** Manual stock movements a user can record on a batch (§11.3, US-017). */
export const MOVEMENT_TYPES = [
  'HOUSEHOLD_USE',
  'DAMAGE',
  'WASTE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
] as const satisfies readonly ProduceTxnType[];
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** AC-IN-004: adjustments change reconciled stock, so they need a reason. */
export function reasonRequired(type: ProduceTxnType): boolean {
  return type === 'ADJUSTMENT_IN' || type === 'ADJUSTMENT_OUT';
}

export class StockError extends Error {
  constructor(
    public readonly state: ProduceState,
    public readonly available: number
  ) {
    super(`Only ${available} ${state.toLowerCase()} in stock`);
    this.name = 'StockError';
  }
}

/**
 * Apply one transaction to a cached per-state balance. Never lets a state go
 * below zero (AC-IN-002): throws StockError with what is actually available.
 * The transaction's states must be states this batch has.
 */
export function applyTxn(byState: StockByState, txn: ProduceTxn): StockByState {
  const next: StockByState = { ...byState };
  const add = (s: ProduceState | undefined, d: number) => {
    if (!s || !(s in next)) throw new StockError(s ?? 'FRESH', 0);
    next[s] = roundQty((next[s] ?? 0) + d);
  };
  if (txn.type === 'PROCESSING') {
    add(txn.fromState, -txn.quantity);
    add(txn.toState, txn.quantity);
  } else {
    add(
      txn.state ?? (Object.keys(next)[0] as ProduceState),
      INBOUND.includes(txn.type) ? txn.quantity : -txn.quantity
    );
  }
  for (const s of Object.keys(next) as ProduceState[]) {
    if ((next[s] ?? 0) < 0) throw new StockError(s, byState[s] ?? 0);
  }
  return next;
}
