#!/usr/bin/env node
/**
 * JavaScript budget per page (#108, SRS §25.2). Run after `next build`.
 *
 * First-load JS = everything a phone downloads before a page is interactive
 * (framework, _app and the page's own chunks), gzipped, as Next.js reports it.
 * The budget keeps cold loads on a 4G connection fast. See
 * docs/PERFORMANCE.md for how the numbers were chosen.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** kB (gzip). Raise only with a reason recorded in docs/PERFORMANCE.md. */
export const BUDGET = { page: 365, shared: 280 };

export function firstLoadFiles(manifest, route) {
  const files = new Set([
    ...(manifest.pages['/_app'] ?? []),
    ...(manifest.pages[route] ?? []),
  ]);
  return [...files].filter(f => f.endsWith('.js'));
}

function main() {
  const dir = join(process.cwd(), '.next');
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(join(dir, 'build-manifest.json'), 'utf8')
    );
  } catch {
    console.error('check-bundle-budget: run `next build` first');
    process.exit(2);
  }
  const sizes = new Map();
  const kb = files =>
    files.reduce((sum, f) => {
      if (!sizes.has(f))
        sizes.set(f, gzipSync(readFileSync(join(dir, f))).length / 1024);
      return sum + sizes.get(f);
    }, 0);

  const shared = kb(firstLoadFiles(manifest, '/_app'));
  const rows = Object.keys(manifest.pages)
    .filter(r => !['/_app', '/_error'].includes(r))
    .map(route => ({ route, kb: kb(firstLoadFiles(manifest, route)) }))
    .sort((a, b) => b.kb - a.kb);

  const over = rows.filter(r => r.kb > BUDGET.page);
  console.log(
    `shared ${shared.toFixed(0)} kB (budget ${BUDGET.shared}) · largest ${rows
      .slice(0, 3)
      .map(r => `${r.route} ${r.kb.toFixed(0)} kB`)
      .join(', ')} (budget ${BUDGET.page})`
  );
  if (shared > BUDGET.shared || over.length) {
    if (shared > BUDGET.shared)
      console.error(
        `Shared JS ${shared.toFixed(0)} kB is over ${BUDGET.shared} kB`
      );
    for (const r of over)
      console.error(
        `${r.route}: ${r.kb.toFixed(0)} kB is over ${BUDGET.page} kB`
      );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
