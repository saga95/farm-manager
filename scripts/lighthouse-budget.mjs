#!/usr/bin/env node
/**
 * Lighthouse mobile budget (#108, SRS §25.2) against a deployed URL:
 *   node scripts/lighthouse-budget.mjs https://development.d2tkbaot482mat.amplifyapp.com
 * Lighthouse mobile run (mid-range phone, slow 4G, 4x CPU slowdown) with
 * *applied* (devtools) throttling: the page really loads over the throttled
 * link and the paint is measured. The default simulated mode over-reports LCP
 * on these server-rendered pages: it assumes the text waits for the deferred
 * scripts (measured: real LCP ≈ FCP). See docs/PERFORMANCE.md.
 * Runs each page 3 times and judges the median, because single runs are noisy.
 * Needs Chrome: CHROME_PATH, or Playwright's Chromium.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const LIGHTHOUSE_BUDGET = {
  performance: 90, // score, 0-100
  accessibility: 100,
  lcpMs: 2500,
  tbtMs: 200,
  cls: 0.1,
};

/** Public pages (signed-in pages need an account; see the JS budget for those). */
const PAGES = ['/auth/login', '/auth/register', '/offline'];
const RUNS = 3;

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!base) {
  console.error('usage: lighthouse-budget.mjs <base url>');
  process.exit(2);
}

async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const { chromium } = await import('@playwright/test');
  return chromium.executablePath();
}

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const dir = mkdtempSync(join(tmpdir(), 'lh-'));
const env = { ...process.env, CHROME_PATH: await chromePath() };
let failed = false;

for (const path of PAGES) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) {
    const out = join(dir, `${path.replace(/\W/g, '_')}-${i}.json`);
    execFileSync(
      'npx',
      [
        '-y',
        'lighthouse@12',
        `${base}${path}`,
        '--only-categories=performance,accessibility',
        '--throttling-method=devtools',
        '--output=json',
        `--output-path=${out}`,
        '--chrome-flags=--headless=new --no-sandbox',
        '--quiet',
      ],
      { env, stdio: 'ignore' }
    );
    const r = JSON.parse(readFileSync(out, 'utf8'));
    runs.push({
      performance: Math.round(r.categories.performance.score * 100),
      accessibility: Math.round(r.categories.accessibility.score * 100),
      lcpMs: r.audits['largest-contentful-paint'].numericValue,
      tbtMs: r.audits['total-blocking-time'].numericValue,
      cls: r.audits['cumulative-layout-shift'].numericValue,
    });
  }
  const m = Object.fromEntries(
    Object.keys(LIGHTHOUSE_BUDGET).map(k => [k, median(runs.map(r => r[k]))])
  );
  const misses = [
    m.performance < LIGHTHOUSE_BUDGET.performance &&
      `performance ${m.performance}`,
    m.accessibility < LIGHTHOUSE_BUDGET.accessibility &&
      `accessibility ${m.accessibility}`,
    m.lcpMs > LIGHTHOUSE_BUDGET.lcpMs && `LCP ${Math.round(m.lcpMs)} ms`,
    m.tbtMs > LIGHTHOUSE_BUDGET.tbtMs && `TBT ${Math.round(m.tbtMs)} ms`,
    m.cls > LIGHTHOUSE_BUDGET.cls && `CLS ${m.cls.toFixed(2)}`,
  ].filter(Boolean);
  console.log(
    `${misses.length ? '✗' : '✓'} ${path}: performance ${m.performance}, accessibility ${m.accessibility}, LCP ${Math.round(m.lcpMs)} ms, TBT ${Math.round(m.tbtMs)} ms, CLS ${m.cls.toFixed(2)}${misses.length ? `  (over: ${misses.join(', ')})` : ''}`
  );
  if (misses.length) failed = true;
}
process.exit(failed ? 1 : 0);
