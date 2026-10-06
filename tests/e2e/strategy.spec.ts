import { expect, type Page, test } from '@playwright/test';
import { PACK } from './routes';

async function asPersona(page: Page, archetype: string) {
  await page.getByTestId('persona-trigger').click();
  await page.locator(`[data-persona="${archetype}"]`).click();
  await expect(page.getByTestId('persona-trigger')).toContainText(`· ${archetype}`);
}

test('AC11.1 Knockout: turning Context off moves the flagged SAIDI answer by the declared delta and marks it wrong', async ({ page }) => {
  await page.goto(`/${PACK}/why/knockout`);
  await asPersona(page, 'D');
  const saidi = page.locator('[data-answer="KO-UTL-01"]');
  await expect(saidi).toHaveAttribute('data-delta', '0');
  await expect(saidi).toHaveAttribute('data-confidence', 'trusted');
  await page.locator('[data-layer="context"]').check();
  await page.getByTestId('knockout-apply').click();
  await expect(page).toHaveURL(/off=context/);
  await expect(saidi).toHaveAttribute('data-delta', '80');
  await expect(saidi.locator('[data-failure="wrong"]')).toBeVisible();
  await expect(saidi).toHaveAttribute('data-confidence', 'questionable');
});

test('AC11.2 Readiness: the early preset scores 1.3 (Exploring); the gaps generate the roadmap', async ({ page }) => {
  await page.goto(`/${PACK}/readiness`);
  await page.locator('[data-preset="early"]').click();
  await expect(page.getByTestId('readiness-overall')).toHaveAttribute('data-score', '1.3');
  await expect(page.getByTestId('readiness-overall')).toContainText('Exploring');
  await expect(page.getByTestId('readiness-gaps').locator('li').first()).toHaveAttribute('data-gap', 'semantics');
  await page.getByTestId('readiness-roadmap').click();
  await expect(page.getByTestId('roadmap-gantt')).toHaveAttribute('data-current', '3');
});

test('Readiness answered live and saved as a named assessment', async ({ page }) => {
  await page.goto(`/${PACK}/readiness?preset=mid`);
  await page.locator('input[name="S1"][value="4"]').check();
  await page.getByTestId('readiness-score').click();
  await expect(page).toHaveURL(/S1=4/);
  await page.locator('input[name="name"]').fill('Client workshop');
  await page.getByTestId('readiness-save').click();
  await expect(page.getByTestId('readiness-saved')).toContainText('Client workshop');
});

test('Portfolio: a human override with a reason re-ranks a product; maturity shows six evidence-based levels', async ({ page }) => {
  await page.goto(`/${PACK}/portfolio`);
  await asPersona(page, 'B');
  const rows = page.getByTestId('portfolio-ranking').locator('tbody tr');
  const lastId = await rows.last().getAttribute('data-product');
  const form = page.getByTestId(`override-${lastId}`);
  await page.locator(`tr[data-product="${lastId}"] summary`).click();
  await form.locator('input[type="number"]').fill('99');
  await form.locator('input:not([type])').fill('Board priority this quarter');
  await form.getByRole('button').click();
  await expect(form.getByTestId('action-result')).toHaveAttribute('data-ok', 'true');
  await page.reload();
  await expect(page.locator(`tr[data-product="${lastId}"]`)).toHaveAttribute('data-rank', '1');
  await expect(page.getByTestId('maturity').locator('li')).toHaveCount(6);
});

test('Operating model switches style; Platform Map replays the flow and lists nine layers; Compare pairs raw and governed', async ({ page }) => {
  await page.goto(`/${PACK}/operating-model`);
  await page.locator('[data-style="federated"]').click();
  await expect(page.getByTestId('raci')).toHaveAttribute('data-style', 'federated');
  await page.goto(`/${PACK}/platform-map`);
  await expect(page.getByTestId('platform-layers').locator('> li')).toHaveCount(9);
  await page.getByTestId('flow-replay-run').click();
  await expect(page.getByTestId('flow-replay').locator('[data-step="agent"]')).toBeVisible();
  await page.goto(`/${PACK}/why/compare`);
  await expect(page.locator('[data-compare]')).toHaveCount(4);
});
