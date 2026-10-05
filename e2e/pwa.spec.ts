import { expect, test } from '@playwright/test';

test.describe('installable app (#104)', () => {
  test('serves a manifest with app icons', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const manifest = (await res.json()) as {
      name: string;
      display: string;
      icons: { src: string; purpose: string }[];
    };
    expect(manifest.name).toBe('My Smart Need AgriTech');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some(i => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons)
      expect((await request.get(icon.src)).ok()).toBeTruthy();
  });

  test('links the manifest and the iOS icon; the service worker script exists', async ({
    page,
    request,
  }) => {
    await page.goto('/auth/sign-in');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.json'
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    expect((await request.get('/sw.js')).ok()).toBeTruthy();
  });

  test('has an offline page', async ({ page }) => {
    await page.goto('/offline');
    await expect(
      page.getByRole('heading', { name: "You're offline" })
    ).toBeVisible();
  });
});
