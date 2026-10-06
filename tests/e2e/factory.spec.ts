import { expect, type Page, test } from '@playwright/test';
import { PACK } from './routes';

async function asPersona(page: Page, archetype: string) {
  await page.getByTestId('persona-trigger').click();
  await page.locator(`[data-persona="${archetype}"]`).click();
  await expect(page.getByTestId('persona-trigger')).toContainText(`· ${archetype}`);
}

test('Agent Factory: build, evaluate, gate and release an agent; it appears in the Marketplace and answers in Ask', async ({ page }) => {
  await page.goto(`/${PACK}/factory`);
  await asPersona(page, 'C');
  await page.getByTestId('new-agent').click();
  await expect(page.getByTestId('factory-wizard')).toBeVisible();
  await page.getByTestId('agent-name').fill('Meter Read Monitor');
  await page.getByTestId('agent-capability').fill('Answers meter read quality and consumption questions.');
  await page.locator('[data-step="2"]').click();
  await expect(page.locator('input[data-product="DP-UTL-007"]')).toBeDisabled();
  await page.locator('input[data-product="DP-UTL-003"]').check();
  await page.getByTestId('design').click();
  await expect(page.getByTestId('factory-note')).toContainText('Drafted coverage');
  await page.locator('[data-step="5"]').click();
  await page.getByTestId('run-eval').click();
  await expect(page.getByTestId('factory-result')).toBeVisible();
  await expect(page.locator('[data-suite="golden"]')).toHaveAttribute('data-passed', 'true');
  await page.locator('[data-step="6"]').click();
  await page.getByTestId('run-gate').click();
  await expect(page.locator('[data-gate-check="2"]')).toHaveAttribute('data-passed', 'true');
  await expect(page.locator('[data-gate-check="8"]')).toHaveAttribute('data-passed', 'false');
  await page.locator('[data-step="7"]').click();
  await page.getByTestId('release-rationale').fill('Eval and gate pass');
  await page.getByTestId('release-pilot').click();
  await expect(page.getByTestId('factory-result')).toContainText('pilot');
  await page.goto(`/${PACK}/marketplace?tab=agents`);
  await expect(page.getByTestId('agent-card').filter({ hasText: 'Meter Read Monitor' })).toBeVisible();
  const card = page.getByTestId('agent-card').filter({ hasText: 'Meter Read Monitor' });
  await card.getByRole('link', { name: 'Ask' }).click();
  await page.getByTestId('ask-input').fill('What is the AMI read success rate by region last month?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByTestId('answer-card').first()).toHaveAttribute('data-kind', 'answer');
});

test('AC4.2 when the live model is unavailable (the e2e key is a planted fake), Auto mode answers from the scripted engine with a visible fallback badge — never an error', async ({ page }) => {
  await page.goto(`/${PACK}/ask/AG-UTL-002`);
  await page.getByTestId('ask-mode').selectOption('auto');
  await page.getByTestId('ask-input').fill('What was SAIDI by region last quarter?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const card = page.getByTestId('answer-card').first();
  await expect(card.getByTestId('answer-mode')).toHaveAttribute('data-mode', 'live_fallback');
  await expect(card.locator('[data-banner="fallback"]')).toBeVisible();
  await expect(card).toHaveAttribute('data-kind', 'answer');
});
