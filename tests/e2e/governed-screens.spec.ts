import { expect, type Page, test } from '@playwright/test';
import { PACK } from './routes';

async function asPersona(page: Page, archetype: string) {
  await page.getByTestId('persona-trigger').click();
  await page.locator(`[data-persona="${archetype}"]`).click();
  await expect(page.getByTestId('persona-trigger')).toContainText(`· ${archetype}`);
}

test('AC8.1 the same object preview is masked for persona B and clear for persona D', async ({ page }) => {
  await page.goto(`/${PACK}/explorer/CURATED_SILVER/CUSTOMER`);
  await asPersona(page, 'B');
  const grid = page.getByTestId('data-grid');
  await expect(page.getByTestId('masked-count')).toBeVisible();
  await expect(grid.locator('td[data-masked]').first()).toHaveText('•••');
  await expect(page.locator('[data-policy="masking"]').first()).toBeVisible();

  await asPersona(page, 'D');
  await expect(page.getByTestId('masked-count')).toHaveCount(0);
  await expect(grid.locator('td[data-masked]')).toHaveCount(0);
  await expect(grid).toContainText('@examplemail.com');
});

test('AC8.2 non-SELECT statements are rejected with a friendly message and nothing runs', async ({ page }) => {
  await page.goto(`/${PACK}/explorer/worksheet`);
  const sql = page.getByTestId('worksheet-sql');
  await sql.fill('DROP TABLE CONFORMED_GOLD.DIM_DATE');
  await page.getByTestId('worksheet-run').click();
  await expect(page.getByTestId('worksheet-rejected')).toContainText('Only read-only SELECT queries');
  await sql.fill("SELECT * FROM read_csv('/etc/passwd')");
  await page.getByTestId('worksheet-run').click();
  await expect(page.getByTestId('worksheet-rejected')).toContainText('not allowed');
  await sql.fill('SELECT count(*) AS n FROM CONFORMED_GOLD.DIM_DATE');
  await page.getByTestId('worksheet-run').click();
  await expect(page.getByTestId('worksheet-result')).toContainText('1 rows');
});

test('worksheet results obey row filters for the regional persona', async ({ page }) => {
  await page.goto(`/${PACK}/explorer/worksheet`);
  await asPersona(page, 'C');
  await page.getByTestId('worksheet-sql').fill('SELECT DISTINCT region FROM CURATED_SILVER.FEEDER ORDER BY 1');
  await page.getByTestId('worksheet-run').click();
  await expect(page.getByTestId('worksheet-result')).toContainText('5 rows');
});

test('Playground: SAIDI by region last quarter — East first, BR-UTL-012 applied, display SQL shown', async ({ page }) => {
  await page.goto(`/${PACK}/semantic/RELIABILITY?tab=playground&metric=saidi&dim=region&range=last-quarter`);
  await asPersona(page, 'B');
  const rows = page.getByTestId('data-grid').locator('tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText('East');
  await expect(page.getByTestId('playground')).toContainText('BR-UTL-012');
  await expect(page.getByTestId('playground')).toContainText('NVE_AI_PLATFORM.CONFORMED_GOLD.FCT_OUTAGE');
});

test('Playground denies a product the persona cannot access, with a Request CTA', async ({ page }) => {
  await page.goto(`/${PACK}/semantic/PROCUREMENT?tab=playground&metric=total_spend`);
  await asPersona(page, 'A');
  await expect(page.getByTestId('outcome-denied')).toContainText('Procurement Spend');
  await expect(page.getByRole('link', { name: 'Request access' })).toBeVisible();
});

test('document search highlights matching passages', async ({ page }) => {
  await page.goto(`/${PACK}/context/documents?q=major%20event%20days`);
  await expect(page.getByTestId('doc-hits').locator('li').first()).toContainText('IEEE 1366');
  await expect(page.getByTestId('doc-hits').locator('mark').first()).toBeVisible();
});
