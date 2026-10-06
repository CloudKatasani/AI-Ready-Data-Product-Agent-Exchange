import { expect, test } from '@playwright/test';
import { PACK, SCREEN_URLS } from './routes';

// Invariant I11: the planted ANTHROPIC_API_KEY (playwright.config.ts) never reaches the browser.
const PLANTED = 'sk-ant-e2e-planted';

test('a planted API key never appears in rendered HTML or loaded scripts', async ({ page }) => {
  const bodies: string[] = [];
  page.on('response', async (r) => {
    const type = r.headers()['content-type'] ?? '';
    if (/javascript|html|json|text\/x-component/.test(type)) bodies.push(await r.text().catch(() => ''));
  });
  for (const url of ['/launch', `/${PACK}/home`, ...SCREEN_URLS.slice(0, 6)]) {
    await page.goto(url);
    expect(await page.content()).not.toContain(PLANTED);
  }
  expect(bodies.length).toBeGreaterThan(5);
  expect(bodies.some((b) => b.includes(PLANTED))).toBe(false);
});
