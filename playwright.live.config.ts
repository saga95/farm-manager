/**
 * Signed-in E2E against the LIVE dev environment (#128, baseline rule:
 * docs/ENVIRONMENTS_AND_RELEASES.md - no separate test environment).
 *
 * Two dedicated test accounts, each with its own "E2E" farm (never the real
 * or demo farm). Credentials come from env / GitHub secrets:
 *   E2E_DEV_EMAIL, E2E_DEV_PASSWORD        account A (main journeys)
 *   E2E_DEV_EMAIL_B, E2E_DEV_PASSWORD_B    account B (tenant isolation)
 * Without them every test is skipped. Not a merge gate: dev deploys after
 * merge, so this runs on a schedule and on demand (e2e-dev-live.yml).
 */

import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env['E2E_BASE_URL'] ??
  'https://development.d2tkbaot482mat.amplifyapp.com';

export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-live', open: 'never' }],
  ],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'dev-live',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      // Mobile-first product: run the journeys on a phone viewport
      use: { ...devices['Pixel 7'], storageState: 'e2e-live/.auth/a.json' },
    },
  ],
});
