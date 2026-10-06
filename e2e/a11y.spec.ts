import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Public pages have no axe-detectable WCAG 2.2 A/AA violations, in both colour
 * schemes (#109). Signed-in screens are covered through their stories
 * (a11y/stories.a11y.spec.ts).
 */
const PAGES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/confirm',
  '/offline',
  '/this-page-does-not-exist',
];

for (const colorScheme of ['light', 'dark'] as const)
  for (const path of PAGES)
    test(`${path} (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        violations.map(v => ({
          rule: v.id,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ')),
        }))
      ).toEqual([]);
    });
