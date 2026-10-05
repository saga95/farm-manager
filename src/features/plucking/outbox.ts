/**
 * Capture outbox (#103, SRS §30, §41.12): tree counts that couldn't be sent
 * (no signal) are kept on the phone and sent automatically when the phone is
 * back online. Each entry keeps its harvestId, and the server treats a resend
 * with the same tree in the same round as the same record, so a retry never
 * creates a duplicate. Persisted in localStorage, so a reload or a closed tab
 * loses nothing. No conflict engine: the server stays the source of truth.
 */

import { getJsonItem, setJsonItem } from '@/utils/safeStorage';

export interface PendingHarvest {
  tenantId: string;
  roundId: string;
  treeId: string;
  harvestId: string;
  quantity: number;
  approximate: boolean;
  queuedAt: string;
  attempts: number;
  /** PENDING: waiting for signal. FAILED: the server refused it (shown to the user). */
  state: 'PENDING' | 'FAILED';
  error?: string | null;
}

const KEY = 'farm.outbox.harvests.v1';
type Listener = (entries: readonly PendingHarvest[]) => void;

let entries: PendingHarvest[] = getJsonItem<PendingHarvest[]>(KEY, []);
const listeners = new Set<Listener>();

function save(next: PendingHarvest[]) {
  entries = next;
  setJsonItem(KEY, entries);
  listeners.forEach(l => l(entries));
}

export const harvestOutbox = {
  list: (): readonly PendingHarvest[] => entries,
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** Queue (or replace) the count for one tree in one round. */
  put(e: Omit<PendingHarvest, 'queuedAt' | 'attempts' | 'state' | 'error'>) {
    const prev = entries.find(
      x => x.roundId === e.roundId && x.treeId === e.treeId
    );
    save([
      ...entries.filter(x => x !== prev),
      {
        ...e,
        // Keep the first id: the server already may have it from an earlier try
        harvestId: prev?.harvestId ?? e.harvestId,
        queuedAt: prev?.queuedAt ?? new Date().toISOString(),
        attempts: prev?.attempts ?? 0,
        state: 'PENDING',
        error: null,
      },
    ]);
  },
  find: (roundId: string, treeId: string) =>
    entries.find(x => x.roundId === roundId && x.treeId === treeId),
  remove(harvestId: string) {
    save(entries.filter(x => x.harvestId !== harvestId));
  },
  update(harvestId: string, patch: Partial<PendingHarvest>) {
    save(
      entries.map(x => (x.harvestId === harvestId ? { ...x, ...patch } : x))
    );
  },
  /** Test helper */
  reset() {
    save([]);
  },
};

export type SendResult = 'SENT' | 'OFFLINE' | 'REFUSED';

/**
 * Try to send every PENDING entry once, oldest first. `send` returns how it
 * went; refused entries stay visible as FAILED with the reason.
 */
export async function flushOutbox(
  send: (e: PendingHarvest) => Promise<{ result: SendResult; error?: string }>
): Promise<{ sent: PendingHarvest[]; remaining: number }> {
  const sent: PendingHarvest[] = [];
  const queue = [...entries]
    .filter(e => e.state === 'PENDING')
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  for (const e of queue) {
    const { result, error } = await send(e);
    if (result === 'SENT') {
      harvestOutbox.remove(e.harvestId);
      sent.push(e);
    } else if (result === 'REFUSED') {
      harvestOutbox.update(e.harvestId, {
        state: 'FAILED',
        error: error ?? null,
        attempts: e.attempts + 1,
      });
    } else {
      harvestOutbox.update(e.harvestId, { attempts: e.attempts + 1 });
      break; // still offline: stop, try again later
    }
  }
  return { sent, remaining: entries.filter(e => e.state === 'PENDING').length };
}
