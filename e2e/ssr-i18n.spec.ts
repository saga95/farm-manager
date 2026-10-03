import { expect, test } from '@playwright/test';

// #120: server-rendered HTML must contain real text, not translation keys.
test.describe('server-rendered translations', () => {
  test.use({ javaScriptEnabled: false });

  test('sign-in renders English text without JavaScript', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle('Sign in · My Smart Need AgriTech');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
    await expect(
      page.getByText("Your farm's records, in one place.")
    ).toBeVisible();
  });

  test('app pages render a translated loading state, never keys or private content', async ({
    page,
  }) => {
    await page.goto('/farm');
    await expect(page).toHaveTitle('Farm · My Smart Need AgriTech');
    await expect(page.getByRole('status')).toHaveText('Loading your farm…');
  });
});
