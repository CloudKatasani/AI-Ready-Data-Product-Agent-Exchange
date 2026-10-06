import { expect, type Page, test } from '@playwright/test';
import { PACK } from './routes';

async function asPersona(page: Page, archetype: string) {
  await page.getByTestId('persona-trigger').click();
  await page.locator(`[data-persona="${archetype}"]`).click();
  await expect(page.getByTestId('persona-trigger')).toContainText(`· ${archetype}`);
}

async function askSaidi(page: Page) {
  await page.goto(`/${PACK}/ask/AG-UTL-002`);
  await page.getByTestId('ask-input').fill('What was SAIDI by region last quarter?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const card = page.getByTestId('answer-card').first();
  await expect(card).toHaveAttribute('data-kind', 'answer');
  return card;
}

test.describe.configure({ mode: 'serial' });

test('AC10.1 Break the late feed: the product degrades, the next answer carries an incident banner and Questionable; Resolve restores Trusted with a postmortem', async ({ page }) => {
  await page.goto(`/${PACK}/health`);
  await asPersona(page, 'D');
  await page.getByTestId('break-INC-UTL-LATE-FEED').click();
  await expect(page.getByTestId('open-INC-UTL-LATE-FEED')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="health-board"] tr[data-product="DP-UTL-002"]')).toHaveAttribute('data-status', 'degraded');

  const during = await askSaidi(page);
  await expect(during.locator('[data-banner="incident"]')).toContainText('INC-UTL-LATE-FEED');
  await expect(during.getByTestId('answer-confidence')).toHaveText('Questionable');

  await page.goto(`/${PACK}/marketplace`);
  await expect(page.locator('[data-product="DP-UTL-002"] [data-health="degraded"]')).toBeVisible();

  await page.goto(`/${PACK}/health/incidents`);
  await page.getByTestId('resolve-INC-UTL-LATE-FEED').click();
  await expect(page.locator('[data-incident="INC-UTL-LATE-FEED"][data-state="RESOLVED"]').getByTestId('postmortem')).toBeVisible({ timeout: 30_000 });

  const after = await askSaidi(page);
  await expect(after.locator('[data-banner="incident"]')).toHaveCount(0);
  await expect(after.getByTestId('answer-confidence')).toHaveText('Trusted');
});

test('AC10.2 the thumbs-down in the feedback inbox is fixed with the suggested synonym; the eval moves 88% → 94%', async ({ page }) => {
  await page.goto(`/${PACK}/agent-quality/feedback`);
  await asPersona(page, 'D');
  const item = page.locator('[data-testid="feedback-inbox"] article[data-state="NEW"]').filter({ hasText: 'gone green' });
  await expect(item).toBeVisible();
  const id = await item.getAttribute('data-feedback');
  await item.getByTestId('apply-scripted-fix').click();
  await expect(page.locator(`article[data-feedback="${id}"]`).getByTestId('fix-delta')).toContainText('88% → 94%', { timeout: 60_000 });
  await page.goto(`/${PACK}/agent-quality`);
  await expect(page.getByTestId('quality-AG-UTL-001')).toHaveAttribute('data-score', '94');
});

test('Impact: renaming a contracted Gold column is high severity with a major bump and a change plan', async ({ page }) => {
  await page.goto(`/${PACK}/impact?object=CONFORMED_GOLD.FCT_OUTAGE&column=customer_minutes&change=rename`);
  const r = page.getByTestId('impact-result');
  await expect(r).toHaveAttribute('data-severity', 'high');
  await expect(r).toHaveAttribute('data-bump', 'major');
});

test('Cost & Value: a fresher lag raises the illustrative total; Audit shows a verified hash chain', async ({ page }) => {
  await page.goto(`/${PACK}/cost-value`);
  const base = Number(await page.getByTestId('cost-total').getAttribute('data-value'));
  await page.goto(`/${PACK}/cost-value?lag=0.25`);
  expect(Number(await page.getByTestId('cost-total').getAttribute('data-value'))).toBeGreaterThan(base);
  await page.goto(`/${PACK}/audit`);
  await expect(page.getByTestId('audit-chain')).toHaveAttribute('data-ok', 'true');
  await expect(page.getByTestId('audit-stream').locator('tbody tr').first()).toBeVisible();
});
