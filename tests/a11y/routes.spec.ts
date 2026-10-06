import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SCREEN_URLS, STUB_URLS } from '../e2e/routes';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const url of [...new Set(['/launch', ...SCREEN_URLS, ...STUB_URLS.slice(0, 3)])]) {
  test(`no serious or critical axe violations on ${url}`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')})`)).toEqual([]);
  });
}
