import { expect, test } from '@playwright/test';

// The shell is covered by Jest + Storybook. Without a backend in CI, these
// tests verify the sign-in gate and public auth screens (#28, #31).
test.describe('Sign-in gate', () => {
  test('app pages send signed-out users to sign-in with a return path', async ({
    page,
  }) => {
    await page.goto('/farm');
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Ffarm$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in' })
    ).toBeVisible();
  });

  test('setup requires sign-in', async ({ page }) => {
    await page.goto('/setup');
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fsetup$/);
  });

  test('sign-in validates input before calling Cognito', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByText('This field is required')).toBeVisible();
  });

  test('sign-up enforces the password policy', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel(/^Password/).fill('weak');
    await page.getByLabel('Confirm password').fill('weak');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByLabel(/^Password/)).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  test('sign-up requires matching passwords', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel(/^Password/).fill('Coconut#2026');
    await page.getByLabel('Confirm password').fill('Coconut#2027');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('auth pages link to each other', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create your account' })
    ).toBeVisible();
  });
});

test.describe('Farm screens', () => {
  for (const path of ['/farm/zones', '/farm/spaces']) {
    test(`${path} requires sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/auth/login\\?redirect=${encodeURIComponent(path)}$`)
      );
    });
  }
});

test.describe('Coconut screens', () => {
  for (const path of ['/coconut/trees', '/coconut/trees/bulk']) {
    test(`${path} requires sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/auth/login\\?redirect=${encodeURIComponent(path)}$`)
      );
    });
  }
});

test.describe('Plucking screens', () => {
  for (const path of ['/coconut/rounds', '/coconut/rounds/new']) {
    test(`${path} requires sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/auth/login\\?redirect=${encodeURIComponent(path)}$`)
      );
    });
  }
});
