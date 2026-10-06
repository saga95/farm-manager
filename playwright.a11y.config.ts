import { defineConfig, devices } from '@playwright/test';

/**
 * Accessibility gate (#109): axe over every Storybook story, light and dark,
 * on a phone viewport. Needs `pnpm build-storybook` first; serves the static
 * build itself.
 */
export default defineConfig({
  testDir: './a11y',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  ...(process.env['CI'] ? { workers: 4 } : {}),
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:6106',
  },
  webServer: {
    command: 'node a11y/serve-static.mjs storybook-static 6106',
    url: 'http://localhost:6106/index.json',
    reuseExistingServer: !process.env['CI'],
  },
});
