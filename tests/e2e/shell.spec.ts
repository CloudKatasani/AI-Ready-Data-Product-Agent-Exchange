import { expect, test } from '@playwright/test';
import { SCAFFOLD_URLS, SHELL_PACK } from './routes';

test('root redirects to the launcher', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/launch$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('synthetic-footer')).toBeVisible();
});

test('launcher opens the shell with all five doors', async ({ page }) => {
  await page.goto('/launch');
  await page.getByTestId('launcher-empty').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/${SHELL_PACK}/home$`));
  const nav = page.getByRole('navigation', { name: 'Primary' });
  for (const door of ['Consume', 'Build', 'Run', 'Strategy']) {
    await expect(nav.getByRole('button', { name: door })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('active-pack')).toHaveText(SHELL_PACK);
});

test('door navigation moves between modules and collapses', async ({ page }) => {
  await page.goto(`/${SHELL_PACK}/home`);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('link', { name: 'Explorer' }).click();
  await expect(page).toHaveURL(new RegExp(`/${SHELL_PACK}/explorer$`));
  await expect(nav.getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'Build' }).click();
  await expect(nav.getByRole('link', { name: 'Explorer' })).toBeHidden();
});

test('pack index redirects to home; bad pack ids and extra segments 404', async ({ page }) => {
  await page.goto(`/${SHELL_PACK}`);
  await expect(page).toHaveURL(new RegExp(`/${SHELL_PACK}/home$`));
  expect((await page.goto('/Not_A_Pack/home'))?.status()).toBe(404);
  expect((await page.goto(`/${SHELL_PACK}/health/a/b`))?.status()).toBe(404);
});

test('health endpoint responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: 'ok' });
});

for (const url of SCAFFOLD_URLS) {
  test(`scaffold renders ${url}`, async ({ page }) => {
    const res = await page.goto(url);
    expect(res?.status()).toBe(200);
    await expect(page.locator('[data-stub]')).toBeVisible();
    await expect(page.getByTestId('synthetic-footer')).toBeVisible();
  });
}
