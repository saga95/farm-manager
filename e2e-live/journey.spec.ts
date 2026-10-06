import { type Page, expect, test } from '@playwright/test';
import { RUN, hasA } from './env';

/**
 * The coconut journey on a phone (E2E-002 … E2E-009), in the test account's
 * own farm. Serial: each step builds on the last; the run cleans up after
 * itself (removes its sale, its round and archives its buyer).
 */
test.describe.configure({ mode: 'serial' });
test.skip(!hasA, 'E2E_DEV_EMAIL / E2E_DEV_PASSWORD not set');

const COUNTS = [13, 18, 9, 20, 15, 11, 17, 14, 12]; // 9 trees (E2E-003)
const TOTAL = COUNTS.reduce((a, b) => a + b, 0);
let roundUrl = '';
let saleUrl = '';
let buyerUrl = '';

async function stockTotal(page: Page): Promise<number> {
  await page.goto('/inventory/produce');
  const tile = page
    .getByText('In stock', { exact: true })
    .first()
    .locator('xpath=..');
  await expect(tile).toBeVisible();
  const text =
    (await tile.innerText()).replace(/[^\d]/g, ' ').trim().split(/\s+/)[0] ??
    '0';
  return Number(text);
}

test('E2E-002: the farm has at least 9 registered trees (bulk registration on first run)', async ({
  page,
}) => {
  await page.goto('/coconut/trees');
  await expect(
    page.getByRole('heading', { name: 'Coconut trees' })
  ).toBeVisible();
  const empty = page.getByText(/No trees registered yet/);
  if (await empty.isVisible().catch(() => false)) {
    await page.goto('/coconut/trees/bulk');
    await page.getByLabel('How many').fill('50');
    await page.getByRole('button', { name: /Register 50 trees/ }).click();
    await page.waitForURL(/\/coconut\/trees(\?|$)/);
  }
  await expect(
    page
      .getByRole('list', { name: 'Coconut trees' })
      .getByRole('listitem')
      .nth(8)
  ).toBeVisible();
});

test('E2E-003: plan a 9-tree round and record every tree with Save & Next', async ({
  page,
}) => {
  await page.goto('/coconut/rounds/new');
  const picker = page.getByRole('list', { name: 'New plucking round' });
  for (let i = 0; i < 9; i += 1)
    await picker.getByRole('button').nth(i).click();
  await expect(page.getByText('9 trees selected')).toBeVisible();
  await page.getByRole('button', { name: 'Start round' }).click();
  await page.waitForURL(/\/coconut\/rounds\/[0-9A-Z]{26}$/);
  roundUrl = new URL(page.url()).pathname;

  await page.getByRole('button', { name: /^Next: / }).click();
  for (let i = 0; i < COUNTS.length; i += 1) {
    const count = page.getByLabel('Number of coconuts');
    await count.fill(String(COUNTS[i]));
    const last = i === COUNTS.length - 1;
    await page
      .getByRole('button', { name: last ? 'Save' : 'Save & Next', exact: true })
      .click();
    if (!last) await expect(count).toHaveValue('');
  }
});

test('E2E-004: completing the round adds exactly its total to stock', async ({
  page,
}) => {
  const before = await stockTotal(page);
  await page.goto(roundUrl);
  await page.getByRole('button', { name: 'Review & complete' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Review round' })
  ).toContainText(String(TOTAL));
  await page.getByRole('button', { name: 'Complete round' }).click();
  await expect(
    page.getByText(`Round complete. ${TOTAL} coconuts added to stock.`)
  ).toBeVisible();
  expect(await stockTotal(page)).toBe(before + TOTAL);
});

test('E2E-005: one dehusked sample per harvested tree', async ({ page }) => {
  await page.goto(roundUrl);
  await page.getByRole('button', { name: 'Record samples' }).click();
  for (let i = 0; i < COUNTS.length; i += 1) {
    await page.getByRole('button', { name: 'Medium', exact: true }).click();
    const last = i === COUNTS.length - 1;
    await page
      .getByRole('button', {
        name: last ? 'Save' : 'Save & next tree',
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByText(`${COUNTS.length} of ${COUNTS.length} trees sampled`)
  ).toBeVisible();
});

test('E2E-006/007: a tree profile shows its yields, samples and an explained estimate', async ({
  page,
}) => {
  // Open the first tree from the trees list
  await page.goto('/coconut/trees');
  await page
    .getByRole('list', { name: 'Coconut trees' })
    .getByRole('button')
    .first()
    .click();
  await expect(page.getByText('Size from samples')).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: 'Harvest history' })
      .getByRole('listitem')
      .first()
  ).toBeVisible();
  // Either an estimate with "Why this estimate?" or an honest "not enough history"
  await expect(
    page.getByText(/Why this estimate\?|Not enough history/).first()
  ).toBeVisible();
});

test('E2E-008: a Medium-preferring restaurant buyer gets a sale with size lines', async ({
  page,
}) => {
  await page.goto('/sales/buyers');
  await page.getByRole('button', { name: 'Add buyer' }).click();
  await page.getByLabel('Name').fill(`E2E Restaurant ${RUN}`);
  // Medium: No → Preferred (one tap)
  await page.getByRole('button', { name: /^Medium: / }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/sales\/buyers\/[0-9A-Z]{26}$/);
  buyerUrl = new URL(page.url()).pathname;
  await page.getByRole('link', { name: 'Record sale to this buyer' }).click();
  await expect(page.getByText(/Usually wants Medium/)).toBeVisible();
  await page.getByLabel('Nuts').fill('10');
  await page.getByLabel('Price each').fill('120');
  await page.getByRole('button', { name: /Fill from oldest/ }).click();
  await page.getByRole('button', { name: 'Save sale' }).click();
  await page.waitForURL(/\/sales\/[0-9A-Z]{26}$/);
  saleUrl = new URL(page.url()).pathname;
  await expect(page.getByText('Calculated total')).toBeVisible();
});

test('E2E-009: the sale reduced coconut stock; cleanup restores it', async ({
  page,
}) => {
  const afterSale = await stockTotal(page);
  // Remove the sale: its nuts go back
  await page.goto(saleUrl);
  await page.getByRole('button', { name: 'Remove sale' }).click();
  await page.getByRole('button', { name: 'Remove sale' }).last().click();
  await expect(page.getByText(/This sale was removed/)).toBeVisible();
  expect(await stockTotal(page)).toBe(afterSale + 10);
  // Remove the round (its stock is untouched again) and archive the buyer
  await page.goto(roundUrl);
  await page.getByRole('button', { name: 'Remove round' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove round' })
    .click();
  await expect(page.getByText(/This round was removed/)).toBeVisible();
  await page.goto(buyerUrl);
  await page.getByRole('button', { name: 'Archive buyer' }).click();
  await expect(page.getByText('Archived')).toBeVisible();
});
