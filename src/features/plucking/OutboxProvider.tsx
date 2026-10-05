/**
 * Sends queued tree counts when the phone is back online (#103), and exposes
 * connection state for the banner. Mounted once in _app.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, recordTreeHarvest } from '@/lib/api';
import { type PendingHarvest, flushOutbox, harvestOutbox } from './outbox';

const EMPTY: readonly PendingHarvest[] = [];

export function usePendingHarvests(): readonly PendingHarvest[] {
  return useSyncExternalStore(
    harvestOutbox.subscribe,
    harvestOutbox.list,
    () => EMPTY
  );
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

let flushing = false;

export function useFlushOutbox() {
  const qc = useQueryClient();
  return useCallback(async () => {
    if (flushing || harvestOutbox.list().every(e => e.state !== 'PENDING'))
      return;
    flushing = true;
    try {
      const { sent } = await flushOutbox(async e => {
        try {
          await recordTreeHarvest(e.tenantId, {
            roundId: e.roundId,
            treeId: e.treeId,
            harvestId: e.harvestId,
            quantity: e.quantity,
            recordQuality: e.approximate ? 'APPROXIMATE' : 'CONFIRMED',
          });
          return { result: 'SENT' };
        } catch (err) {
          if (
            err instanceof ApiError &&
            err.code !== 'NETWORK' &&
            err.code !== 'INTERNAL'
          )
            return { result: 'REFUSED', error: err.message };
          return { result: 'OFFLINE' };
        }
      });
      await Promise.all(
        [...new Set(sent.map(s => `${s.tenantId}|${s.roundId}`))].map(k => {
          const [tenantId, roundId] = k.split('|');
          return qc.invalidateQueries({
            queryKey: ['round', tenantId, roundId],
          });
        })
      );
      if (sent.length)
        await qc.invalidateQueries({ queryKey: ['treeHistory'] });
    } finally {
      flushing = false;
    }
  }, [qc]);
}

/** Render-less: keeps sending queued counts. Mounted once in _app. */
export function OutboxSync(): null {
  const flush = useFlushOutbox();
  const pending = usePendingHarvests();
  const hasPending = pending.some(e => e.state === 'PENDING');
  useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);
  // While something waits, retry every 30 s (signal can return without an event)
  useEffect(() => {
    if (!hasPending) return undefined;
    const id = window.setInterval(() => void flush(), 30_000);
    return () => window.clearInterval(id);
  }, [hasPending, flush]);
  return null;
}
