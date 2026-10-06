import { type Page, expect, test as setup } from '@playwright/test';
import { STATE, accounts, hasA, hasB } from './env';

/**
 * Sign in and, for a brand-new account, go through first-run setup
 * (E2E-001: owner creates tenant + farm). Saves the session for the specs.
 */
async function signIn(page: Page, who: 'a' | 'b') {
  const { email, password } = accounts[who];
  await page.goto('/auth/login');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Either the dashboard or, for a new account, setup
  await page.waitForURL(
    url => url.pathname === '/' || url.pathname === '/setup',
    { timeout: 60_000 }
  );
  if (new URL(page.url()).pathname === '/setup') {
    await page.getByLabel(/^Account name/).fill(`E2E ${who.toUpperCase()}`);
    await page.getByLabel(/^Farm name/).fill(`E2E farm ${who.toUpperCase()}`);
    await page.getByRole('button', { name: 'Create my farm' }).click();
    await page.waitForURL(url => url.pathname === '/', { timeout: 60_000 });
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.context().storageState({ path: STATE[who] });
}

setup('sign in account A (E2E-001 on first run)', async ({ page }) => {
  setup.skip(!hasA, 'E2E_DEV_EMAIL / E2E_DEV_PASSWORD not set');
  await signIn(page, 'a');
});

setup('sign in account B', async ({ page }) => {
  setup.skip(!hasB, 'E2E_DEV_EMAIL_B / E2E_DEV_PASSWORD_B not set');
  await signIn(page, 'b');
});
