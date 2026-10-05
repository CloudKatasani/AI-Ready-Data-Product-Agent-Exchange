import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SCAFFOLD_URLS } from '../e2e/routes';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const url of ['/launch', ...SCAFFOLD_URLS]) {
  test(`no serious or critical axe violations on ${url}`, async ({ page }) => {
    await page.goto(url);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
