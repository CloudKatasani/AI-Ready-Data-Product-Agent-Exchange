import { expect, type Page, test } from '@playwright/test';
import { PACK } from './routes';

async function asPersona(page: Page, archetype: string) {
  await page.getByTestId('persona-trigger').click();
  await page.locator(`[data-persona="${archetype}"]`).click();
  await expect(page.getByTestId('persona-trigger')).toContainText(`· ${archetype}`);
}

test('Studio board shows every product by phase, with the lifecycle demo product carrying open proposals', async ({ page }) => {
  await page.goto(`/${PACK}/studio`);
  await expect(page.getByTestId('studio-card')).toHaveCount(8);
  await expect(page.locator('[data-testid="studio-card"][data-product="DP-UTL-007"]')).toContainText('open proposals');
});

test('AC6.2 submit is blocked while agent proposals are unreviewed; accepting them unblocks it', async ({ page }) => {
  await page.goto(`/${PACK}/studio/DP-UTL-007`);
  await asPersona(page, 'C');
  await page.reload();
  await expect(page.locator('[data-criterion="no_unreviewed_agent_fields"]')).toHaveAttribute('data-ok', 'false');
  await expect(page.getByTestId('submit-stage')).toBeDisabled();
  await page.getByTestId('accept-all').click();
  await expect(page.locator('[data-criterion="no_unreviewed_agent_fields"]')).toHaveAttribute('data-ok', 'true');
  await expect(page.locator('[data-provenance="AGENT"]').first()).toBeVisible();
  await page.getByTestId('submit-stage').click();
  await expect(page.getByTestId('gate-panel')).toHaveAttribute('data-gate-state', 'IN_REVIEW');
});

test('AC6.3 certification moment: fixes → submit → council quorum (D then E) → Certified v1.0.0', async ({ page }) => {
  await page.goto(`/${PACK}/studio/DP-UTL-005`);
  await asPersona(page, 'D');
  await page.reload();
  const list = page.getByTestId('cert-checklist');
  await expect(list.locator('[data-check="governance.masking"]')).toHaveAttribute('data-status', 'fail');
  await list.getByTestId('fix-FIX-1').click();
  await expect(list.locator('[data-check="semantic.verified_queries"]')).toHaveAttribute('data-status', 'pass');
  await list.getByTestId('fix-FIX-2').click();
  await expect(list.locator('[data-check="governance.masking"]')).toHaveAttribute('data-status', 'pass');

  await asPersona(page, 'C');
  await page.reload();
  await page.getByTestId('submit-stage').click();
  await expect(page.getByTestId('gate-panel')).toHaveAttribute('data-gate-state', 'IN_REVIEW');

  await asPersona(page, 'D');
  await page.reload();
  await page.getByTestId('gate-rationale').fill('All eight checks pass');
  await page.getByTestId('approve-gate').click();
  await expect(page.getByTestId('gate-panel').getByTestId('action-result')).toContainText('in review');
  await asPersona(page, 'E');
  await page.reload();
  await page.getByTestId('approve-gate').click();
  await expect(page.getByTestId('gate-panel').getByTestId('action-result')).toContainText('approved');
  await page.goto(`/${PACK}/marketplace/products/DP-UTL-005`);
  await expect(page.locator('[data-status="CERTIFIED"]').first()).toBeVisible();
  await expect(page.getByRole('main')).toContainText('DP-UTL-005 · v1.0.0');
});

test('AC6.4 editing the contract after Stage 5 approval makes gate 5 STALE', async ({ page }) => {
  await page.goto(`/${PACK}/studio/DP-UTL-006/5`);
  await asPersona(page, 'C');
  await page.reload();
  const contract = page.locator('[data-artifact="data-contract"]');
  await contract.getByTestId('edit-artifact').click();
  const cols = contract.locator('[data-field="columns"]');
  await cols.fill(`${await cols.inputValue()}\nCONFORMED_GOLD.FCT_PO_SPEND.spend_usd`);
  await contract.getByTestId('commit-message').fill('Expose spend');
  await contract.getByTestId('save-artifact').click();
  await expect(page.getByTestId('stale-banner')).toBeVisible();
  await expect(page.locator('[data-stage="5"]')).toHaveAttribute('data-gate', 'STALE');
});

test('AC5.1 / AC5.2 intake surfaces the duplicate, then triage creates a Draft product at Stage 1', async ({ page }) => {
  await page.goto(`/${PACK}/request/new`);
  await page.getByTestId('intake-title').fill('Regional reliability scorecard');
  await page.getByTestId('intake-decision').fill('Which feeders in my region get crews and vegetation work first next quarter');
  await page.getByTestId('intake-next').click();
  await page.getByTestId('intake-decider').fill('Regional Operations Manager');
  await page.getByTestId('intake-cadence').fill('Quarterly');
  await page.getByTestId('intake-next').click();
  await page.getByTestId('intake-q0').fill('What was SAIDI by region last quarter?');
  await page.getByTestId('intake-q1').fill('Which feeders had the most outage minutes?');
  await page.getByTestId('intake-q2').fill('What share of outage minutes were caused by trees?');
  await page.getByTestId('intake-next').click();
  await expect(page.getByTestId('intake-duplicates').locator('[data-duplicate="DP-UTL-002"]')).toBeVisible();
  await page.getByTestId('intake-stakes').fill('Crews go to the wrong feeders');
  await page.getByTestId('intake-next').click();
  await page.getByTestId('intake-next').click();
  await expect(page.getByTestId('intake-done')).toBeVisible();
  await page.getByTestId('intake-done').getByRole('link').click();
  await asPersona(page, 'C');
  await page.reload();
  await page.getByTestId('triage-reason').fill('Regional scorecard owned by grid DPO');
  await page.getByTestId('triage-approve').click();
  await expect(page.getByTestId('request-state')).toHaveAttribute('data-state', 'APPROVED');
  await page.getByTestId('open-created-product').click();
  await expect(page.locator('[data-artifact="decision-register"]')).toContainText('Which feeders in my region');
});

test('exports: evidence pack is a .docx and the audit bundle verifies', async ({ request }) => {
  const docx = await request.get(`/api/export?kind=evidence&pack=${PACK}&product=DP-UTL-002`);
  expect(docx.status()).toBe(200);
  expect((await docx.body()).subarray(0, 2).toString()).toBe('PK');
  const audit = await request.get(`/api/export?kind=audit&pack=${PACK}`);
  expect(audit.headers()['x-audit-chain']).toBe('verified');
  const ol = await request.get(`/api/export?kind=openlineage&pack=${PACK}&product=DP-UTL-002`);
  expect(((await ol.json()) as unknown[]).length).toBeGreaterThan(3);
});
