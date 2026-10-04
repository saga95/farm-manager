/**
 * Produce inventory rules (SRS §11, §41.9, §41.10, CALC-010, ADR-0004).
 * Stock is ALWAYS the sum of transactions; cached balances on a batch must be
 * reconcilable with `balance()`.
 */

export const PRODUCE_STATES = ['HUSKED', 'DEHUSKED'] as const;
export type ProduceState = (typeof PRODUCE_STATES)[number];

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

export type Balance = { total: number; byState: Record<ProduceState, number> };

/** CALC-010: stock = Σ stock-in − Σ stock-out; PROCESSING conserves the total (§41.9). */
export function balance(txns: readonly ProduceTxn[]): Balance {
  const byState: Record<ProduceState, number> = { HUSKED: 0, DEHUSKED: 0 };
  for (const t of txns) {
    if (t.type === 'PROCESSING') {
      if (t.fromState && t.toState) {
        byState[t.fromState] -= t.quantity;
        byState[t.toState] += t.quantity;
      }
      continue;
    }
    const state = t.state ?? 'HUSKED';
    byState[state] += INBOUND.includes(t.type) ? t.quantity : -t.quantity;
  }
  return { total: byState.HUSKED + byState.DEHUSKED, byState };
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
