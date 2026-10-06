import { expect, test } from '@playwright/test';
import { STATE, hasA, hasB } from './env';

/**
 * E2E-012 (AC-TN-003): a user from tenant A cannot open tenant B's record.
 * Account B makes sure it has a tree and shares its URL; account A opens it
 * and gets "not found" - the API refuses, it's not just hidden.
 */
test.skip(
  !hasA || !hasB,
  'Both test accounts are needed (E2E_DEV_EMAIL[_B] / E2E_DEV_PASSWORD[_B])'
);

test('E2E-012: tenant A cannot open tenant B’s tree', async ({
  browser,
  page,
}) => {
  const b = await browser.newContext({ storageState: STATE.b });
  const pageB = await b.newPage();
  await pageB.goto('/coconut/trees');
  if (
    await pageB
      .getByText(/No trees registered yet/)
      .isVisible()
      .catch(() => false)
  ) {
    await pageB.goto('/coconut/trees/bulk');
    await pageB.getByLabel('How many').fill('1');
    await pageB.getByRole('button', { name: /Register 1 trees?/ }).click();
    await pageB.waitForURL(/\/coconut\/trees(\?|$)/);
  }
  await pageB
    .getByRole('list', { name: 'Coconut trees' })
    .getByRole('button')
    .first()
    .click();
  await pageB.waitForURL(/\/coconut\/trees\/[0-9A-Z]{26}$/);
  const bTreeUrl = new URL(pageB.url()).pathname;
  await b.close();

  // Account A (default storage state for this project)
  await page.goto(bTreeUrl);
  await expect(page.getByText('This tree could not be found.')).toBeVisible();
});
