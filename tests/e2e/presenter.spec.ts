import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

/** Unique per run: profiles persist (AC1.3), so earlier runs' profiles are still listed. */
const NAME = `Client pitch ${Date.now().toString(36)}`;

test('AC1.2 a brand colour failing AA is flagged live with an alternative and rejected on save', async ({ page }) => {
  await page.goto('/launch?pack=utilities');
  await page.getByTestId('colour-primary').fill('#7a7a7a');
  await expect(page.locator('[data-contrast="fail"]').first()).toContainText('try #');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('profile-result')).toHaveAttribute('data-ok', 'false');
  await expect(page.getByTestId('profile-result')).toContainText('WCAG AA');
});

test('AC1.1 / AC1.3 save a branded profile and launch it: Home in < 2 s with branding applied', async ({ page }) => {
  await page.goto('/launch?pack=utilities');
  await page.locator('input[name="name"]').fill(NAME);
  await page.getByTestId('profile-company').fill('Client Co');
  await page.getByTestId('colour-primary').fill('#7c2d12');
  await page.getByTestId('profile-story').selectOption('executive-5');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('profile-result')).toHaveAttribute('data-ok', 'true');
  await page.reload();
  const row = page.locator(`[data-profile-name="${NAME}"]`);
  await expect(row).toBeVisible();
  const t0 = Date.now();
  await row.getByTestId('launch-profile').click();
  await page.waitForURL('**/utilities/home');
  await expect(page.getByTestId('brand-name')).toContainText('Client Co');
  expect(Date.now() - t0).toBeLessThan(2000);
  const primary = await page.locator('#main').evaluate((el) => getComputedStyle(el).getPropertyValue('--brand-primary').trim());
  expect(primary).toBe('#7c2d12');
  // The story's first step persona (E) is active.
  await expect(page.getByTestId('persona-trigger')).toContainText('· E');
});

test('AC1.4 Reset restores the starting state in < 3 s and keeps the profile and branding', async ({ page }) => {
  await page.goto('/launch');
  await page.locator(`[data-profile-name="${NAME}"]`).getByTestId('launch-profile').click();
  await page.waitForURL('**/utilities/home');
  await page.goto('/utilities/health');
  await page.getByTestId('break-INC-UTL-VOLUME').click();
  await expect(page.getByTestId('open-INC-UTL-VOLUME')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('presenter-open').click();
  await page.getByTestId('presenter-reset').click();
  const t0 = Date.now();
  await page.getByTestId('presenter-reset-confirm').click();
  await expect(page.getByTestId('presenter-note')).toContainText('Demo reset in');
  expect(Date.now() - t0).toBeLessThan(3000);
  await page.goto('/utilities/health');
  await expect(page.getByTestId('break-INC-UTL-VOLUME')).toBeVisible();
  await expect(page.getByTestId('brand-name')).toContainText('Client Co');
});
