import { expect, test } from '@playwright/test';

// #120: the server-rendered HTML must contain real text, not translation keys.
test.describe('server-rendered translations', () => {
  test.use({ javaScriptEnabled: false });

  test('home renders English text without JavaScript', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Home · My Smart Need AgriTech');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home');
    await expect(page.getByText('New plucking round').first()).toBeVisible();
  });

  test('hub pages render translated navigation', async ({ page }) => {
    await page.goto('/farm');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Farm');
    await expect(page.getByText('Coconut trees')).toBeVisible();
  });
});
