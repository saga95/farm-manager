/**
 * Global search (SCR-029, #102, §19): matches a typed query against records
 * the app already holds. Pure, so it's instant offline-ish and testable.
 * Tree codes match loosely ("c1", "C-001", "001"); dates match by day,
 * month or year ("2026-03", "2026-03-08") and by the displayed date text.
 */

import { normalizeTreeCode } from '@/domain/coconut';

export type ResultKind =
  | 'tree'
  | 'round'
  | 'buyer'
  | 'sale'
  | 'input'
  | 'batch'
  | 'cycle';

export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string | undefined;
  href: string;
}

export interface SearchSources {
  trees: readonly {
    id: string;
    code: string;
    displayLabel?: string | null;
    status: string;
  }[];
  rounds: readonly {
    id: string;
    roundDate: string;
    totalNuts?: number | null;
    deletedAt?: string | null;
  }[];
  buyers: readonly {
    id: string;
    name: string;
    contactName?: string | null;
    phone?: string | null;
  }[];
  sales: readonly {
    id: string;
    saleDate: string;
    buyerName?: string | null;
    totalQuantity: number;
  }[];
  inputs: readonly { id: string; name: string; category: string }[];
  batches: readonly {
    id: string;
    batchDate: string;
    cropCode: string;
    cropName?: string | null;
  }[];
  cycles: readonly {
    id: string;
    name: string;
    cropName: string;
    variety?: string | null;
  }[];
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
const has = (q: string, ...values: (string | null | undefined)[]) =>
  values.some(v => v && norm(v).includes(q));

/** C1 / c-1 / 001 / C-001 all find C-001. */
function treeMatches(raw: string, code: string): boolean {
  const q = normalizeTreeCode(raw).replace(/-/g, '');
  if (!q) return false;
  const c = code.replace(/-/g, '');
  if (c.includes(q)) return true;
  const m = /^([A-Z]*)0*(\d+)$/.exec(q);
  const cm = /^([A-Z]*)0*(\d+)$/.exec(c);
  return Boolean(m && cm && (m[1] === '' || m[1] === cm[1]) && m[2] === cm[2]);
}

export function search(
  query: string,
  src: SearchSources,
  fmtDate: (iso: string) => string,
  limitPerKind = 8
): SearchResult[] {
  const q = norm(query);
  if (q.length < 1) return [];
  const dateHit = (iso: string) =>
    iso.startsWith(query.trim()) || has(q, fmtDate(iso));
  const out: SearchResult[] = [];
  const take = <T>(
    rows: readonly T[],
    hit: (r: T) => boolean,
    map: (r: T) => SearchResult
  ) => out.push(...rows.filter(hit).slice(0, limitPerKind).map(map));

  take(
    src.trees,
    t => treeMatches(query, t.code) || has(q, t.displayLabel),
    t => ({
      kind: 'tree',
      id: t.id,
      title: t.code,
      subtitle: t.displayLabel ?? undefined,
      href: `/coconut/trees/${t.id}`,
    })
  );
  take(
    src.cycles,
    c => has(q, c.name, c.cropName, c.variety),
    c => ({
      kind: 'cycle',
      id: c.id,
      title: c.name,
      subtitle: c.cropName,
      href: `/farm/cycles/${c.id}`,
    })
  );
  take(
    src.buyers,
    b => has(q, b.name, b.contactName, b.phone),
    b => ({
      kind: 'buyer',
      id: b.id,
      title: b.name,
      subtitle: b.contactName ?? undefined,
      href: `/sales/buyers/${b.id}`,
    })
  );
  take(
    src.rounds.filter(r => !r.deletedAt),
    r => dateHit(r.roundDate),
    r => ({
      kind: 'round',
      id: r.id,
      title: fmtDate(r.roundDate),
      href: `/coconut/rounds/${r.id}`,
    })
  );
  take(
    src.sales,
    s => dateHit(s.saleDate) || has(q, s.buyerName),
    s => ({
      kind: 'sale',
      id: s.id,
      title: fmtDate(s.saleDate),
      subtitle: s.buyerName ?? undefined,
      href: `/sales/${s.id}`,
    })
  );
  take(
    src.inputs,
    i => has(q, i.name),
    i => ({
      kind: 'input',
      id: i.id,
      title: i.name,
      href: `/inventory/inputs/${i.id}`,
    })
  );
  take(
    src.batches,
    b => dateHit(b.batchDate) || has(q, b.cropName, b.cropCode),
    b => ({
      kind: 'batch',
      id: b.id,
      title: fmtDate(b.batchDate),
      subtitle: b.cropName ?? b.cropCode,
      href: `/inventory/produce/${b.id}`,
    })
  );
  return out;
}
