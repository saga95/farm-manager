import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Every story, light and dark, must have no WCAG 2.2 A/AA violations that axe
 * can detect (#109). Screen stories cover the signed-in app without a backend.
 */

interface IndexEntry {
  id: string;
  title: string;
  name: string;
  type: string;
}

const index = JSON.parse(
  readFileSync('storybook-static/index.json', 'utf8')
) as { entries: Record<string, IndexEntry> };
const stories = Object.values(index.entries).filter(e => e.type === 'story');

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const theme of ['light', 'dark'] as const)
  for (const story of stories)
    test(`${story.title} / ${story.name} (${theme})`, async ({ page }) => {
      await page.goto(
        `/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`
      );
      // Dialog stories render into a portal next to the root
      await page
        .locator('#storybook-root > *, [role="dialog"]')
        .first()
        .waitFor({ state: 'attached' });
      // Let async content (i18n, fake queries, transitions) settle
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page })
        .exclude('#storybook-docs')
        .withTags(WCAG)
        .analyze();
      expect(
        violations.map(v => ({
          rule: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ')),
        }))
      ).toEqual([]);
    });
