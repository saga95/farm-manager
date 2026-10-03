import { expect, test } from '@playwright/test';

test.describe('App shell (SRS §20)', () => {
  test('home dashboard shows the quick actions and farm sections', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Home' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'New plucking round' })
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Next plucking' })
    ).toBeVisible();
    // PR-007: no fabricated numbers, honest empty states instead
    await expect(
      page.getByText('Not enough history yet.', { exact: false })
    ).toBeVisible();
  });

  test('main navigation reaches every tab', async ({ page }) => {
    await page.goto('/');
    const nav = page
      .getByRole('navigation', { name: 'Main navigation' })
      .locator('visible=true');
    for (const tab of ['Farm', 'Inventory', 'Sales', 'More', 'Home']) {
      await nav.getByRole('link', { name: tab }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: tab })
      ).toBeVisible();
      await expect(nav.getByRole('link', { name: tab })).toHaveAttribute(
        'aria-current',
        'page'
      );
    }
  });

  test('planned screens render a placeholder inside the shell', async ({
    page,
  }) => {
    await page.goto('/coconut/rounds/new');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Coming soon' })
    ).toBeVisible();
    const nav = page
      .getByRole('navigation', { name: 'Main navigation' })
      .locator('visible=true');
    await expect(nav.getByRole('link', { name: 'Farm' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
