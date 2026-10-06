import { expect, type Page, test } from '@playwright/test';
import { PACK } from './routes';

async function asPersona(page: Page, archetype: string) {
  await page.getByTestId('persona-trigger').click();
  await page.locator(`[data-persona="${archetype}"]`).click();
  await expect(page.getByTestId('persona-trigger')).toContainText(`· ${archetype}`);
}

test('AC3.1 Restricted → request as A → approve as D → Granted as A, and the agent now answers', async ({ page }) => {
  await page.goto(`/${PACK}/marketplace/products/DP-UTL-004`);
  await asPersona(page, 'A');
  await page.reload();
  await expect(page.getByTestId('access-badge').first()).toHaveAttribute('data-access', 'Restricted');
  await page.getByTestId('request-access').click();
  const drawer = page.getByTestId('request-drawer');
  await expect(drawer.getByTestId('policy-preview')).toHaveAttribute('data-auto', 'false');
  await drawer.getByTestId('request-justification').fill('Asset health for regional crew planning');
  await drawer.getByTestId('request-submit').click();
  await expect(drawer.getByTestId('request-result')).toHaveAttribute('data-state', 'PENDING');

  await page.goto(`/${PACK}/access`);
  await asPersona(page, 'D');
  await page.reload();
  const item = page.getByTestId('inbox').locator('li', { hasText: 'Grid Asset' }).first();
  await item.getByRole('textbox').fill('Approved for regional planning');
  await item.getByTestId('approve').click();
  await expect(item.getByTestId('inbox-result')).toHaveText('Granted');

  await asPersona(page, 'A');
  await page.goto(`/${PACK}/marketplace/products/DP-UTL-004`);
  await expect(page.getByTestId('access-badge').first()).toHaveAttribute('data-access', 'Granted');
  await page.goto(`/${PACK}/ask/AG-UTL-004?q=${encodeURIComponent('How does asset health compare across vintage bands?')}`);
  await expect(page.getByTestId('answer-card').first()).toHaveAttribute('data-kind', 'answer');
});

test('AC3.2 search "outage minutes" finds the reliability product and the SAIDI KPI', async ({ page }) => {
  await page.goto(`/${PACK}/marketplace`);
  await page.getByTestId('catalog-search').fill('outage minutes');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByTestId('product-card').first()).toHaveAttribute('data-product', 'DP-UTL-002');
  await expect(page.getByTestId('kpi-hits').locator('[data-kpi="KPI-UTL-SAIDI"]')).toBeVisible();
});

test('AC3.3 the quality ring on the card equals the product page and the quality tab', async ({ page }) => {
  await page.goto(`/${PACK}/marketplace?tab=products`);
  const score = await page.locator('[data-product="DP-UTL-002"] [data-testid="quality-ring"]').getAttribute('data-score');
  expect(Number(score)).toBeGreaterThan(0);
  await page.goto(`/${PACK}/marketplace/products/DP-UTL-002?tab=quality`);
  await expect(page.getByTestId('quality-ring').first()).toHaveAttribute('data-score', score ?? '');
  await expect(page.getByTestId('dq-rules').locator('tbody tr').first()).toBeVisible();
});

test('compare, mesh blast radius and demand duplicate check', async ({ page }) => {
  await page.goto(`/${PACK}/marketplace?tab=compare&compare=DP-UTL-002&compare=DP-UTL-004`);
  await expect(page.getByTestId('compare-table').locator('thead th')).toHaveCount(3);
  await page.goto(`/${PACK}/marketplace?tab=mesh`);
  await page.locator('[data-node="DP-UTL-002"]').first().click();
  await expect(page.getByTestId('blast-radius').first()).toContainText('Reliability Analyst');
  await page.goto(`/${PACK}/marketplace?tab=demand`);
  await page.getByTestId('demand-title').fill('Regional reliability scorecard');
  await page.getByTestId('demand-description').fill('SAIDI by region and the feeders with the most outage minutes each quarter');
  await page.getByTestId('demand-submit').click();
  await expect(page.getByTestId('demand-duplicates')).toContainText('Distribution Reliability');
});

test('contract download is ODCS YAML', async ({ request }) => {
  const r = await request.get(`/api/contract?pack=${PACK}&product=DP-UTL-002`);
  expect(r.status()).toBe(200);
  const body = await r.text();
  expect(body).toContain('kind: DataContract');
  expect(body).toContain('apiVersion: v3.0.0');
});
