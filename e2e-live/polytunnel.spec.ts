import { expect, test } from '@playwright/test';
import { RUN, hasA } from './env';

/**
 * Polytunnel on a phone (E2E-010, E2E-011): a cucumber cycle in a polytunnel
 * zone, a 12.5 kg harvest into stock, sold through the same Sales module.
 * Cleans up: removes the sale and cancels the cycle.
 */
test.describe.configure({ mode: 'serial' });
test.skip(!hasA, 'E2E_DEV_EMAIL / E2E_DEV_PASSWORD not set');

let cycleUrl = '';
let saleUrl = '';

test('E2E-010: a cucumber cycle records a 12.5 kg harvest', async ({
  page,
}) => {
  // A polytunnel zone (created on the first run only)
  await page.goto('/farm/zones');
  if (
    !(await page
      .getByText('E2E Polytunnel')
      .isVisible()
      .catch(() => false))
  ) {
    await page.getByRole('button', { name: 'Add zone' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Name/).fill('E2E Polytunnel');
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Polytunnel' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('E2E Polytunnel')).toBeVisible();
  }

  await page.goto('/farm/cycles');
  await page.getByRole('button', { name: 'New cycle' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Crop/).fill(`Cucumber ${RUN}`);
  await dialog.getByLabel(/^Zone/).click();
  await page.getByRole('option', { name: 'E2E Polytunnel' }).click();
  await dialog.getByLabel(/About how many plants/).fill('120');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/farm\/cycles\/[0-9A-Z]{26}$/);
  cycleUrl = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Record harvest' }).click();
  await page.getByLabel(/How much/).fill('12.5');
  await page.getByRole('button', { name: 'Save harvest' }).click();
  await expect(page.getByText(/12\.5 kg/).first()).toBeVisible();
});

test('E2E-011: the harvest is sold through the same Sales module', async ({
  page,
}) => {
  await page.goto('/sales/new');
  await page.getByLabel(/^What are you selling\?/).click();
  await page.getByRole('option', { name: `Cucumber ${RUN}` }).click();
  await page.getByLabel(/^Quantity \(kg\)/).fill('10.5');
  await page.getByLabel(/^Price each/).fill('480');
  await page.getByRole('button', { name: /Fill from oldest/ }).click();
  await page.getByRole('button', { name: 'Save sale' }).click();
  await page.waitForURL(/\/sales\/[0-9A-Z]{26}$/);
  saleUrl = new URL(page.url()).pathname;
  await expect(page.getByText(/10\.5 kg/).first()).toBeVisible();

  // Cleanup: remove the sale, cancel the cycle
  await page.getByRole('button', { name: 'Remove sale' }).click();
  await page.getByRole('button', { name: 'Remove sale' }).last().click();
  await expect(page.getByText(/This sale was removed/)).toBeVisible();
  await page.goto(cycleUrl);
  await page.getByRole('button', { name: 'Cancel cycle' }).click();
  await page
    .getByRole('alert')
    .getByRole('button', { name: 'Cancel cycle' })
    .click();
  await expect(page.getByText('Cancelled')).toBeVisible();
  expect(saleUrl).not.toBe('');
});
