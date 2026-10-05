/**
 * useState that survives a reload (#104 drafts, SRS §30). Stored in
 * localStorage under `farm.draft.<key>`; call `clear()` once the draft has
 * been saved. The key may arrive later (e.g. after the farm loads): the draft
 * is loaded then, and nothing is written for a key before its draft is read.
 * Storage failures (private mode, full) fall back to memory.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getJsonItem, removeItem, setJsonItem } from '@/utils/safeStorage';

const MISSING = Symbol('missing');

export function usePersistentState<T>(
  key: string | null,
  initial: T | (() => T)
): [T, (v: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = key ? `farm.draft.${key}` : null;
  const [value, setValue] = useState<T>(() => {
    const fallback =
      typeof initial === 'function' ? (initial as () => T)() : initial;
    return storageKey ? getJsonItem<T>(storageKey, fallback) : fallback;
  });
  const loadedKey = useRef<string | null>(storageKey);
  const cleared = useRef(false);

  // Key arrived (or changed): load its draft before saving anything under it
  useEffect(() => {
    if (!storageKey || loadedKey.current === storageKey) return;
    loadedKey.current = storageKey;
    const stored = getJsonItem<T | typeof MISSING>(storageKey, MISSING);
    if (stored !== MISSING) setValue(stored as T);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || cleared.current || loadedKey.current !== storageKey)
      return;
    setJsonItem(storageKey, value);
  }, [storageKey, value]);

  const clear = useCallback(() => {
    if (!storageKey) return;
    cleared.current = true;
    removeItem(storageKey);
  }, [storageKey]);

  const set = useCallback((v: T | ((prev: T) => T)) => {
    cleared.current = false;
    setValue(v);
  }, []);

  return [value, set, clear];
}

/** Drop a saved draft from outside the form (e.g. after the parent saved it). */
export function clearPersistentState(key: string): void {
  removeItem(`farm.draft.${key}`);
}
