import { expect, test } from '@playwright/test';
import { PACK, SCREEN_URLS, STUB_URLS } from './routes';

test('root redirects to the launcher, which lists installed packs', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/launch$/);
  const card = page.locator(`[data-pack="${PACK}"]`);
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(new RegExp(`/${PACK}/home$`));
  await expect(page.getByTestId('synthetic-footer')).toContainText('as of');
});

test('door navigation shows five doors and highlights the current module', async ({ page }) => {
  await page.goto(`/${PACK}/home`);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  for (const door of ['Consume', 'Build', 'Run', 'Strategy']) await expect(nav.getByRole('button', { name: door })).toBeVisible();
  await nav.getByRole('link', { name: 'Explorer' }).click();
  await expect(page).toHaveURL(new RegExp(`/${PACK}/explorer$`));
  await expect(nav.getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'Build' }).click();
  await expect(nav.getByRole('link', { name: 'Explorer' })).toBeHidden();
});

test('unknown packs, unknown objects and extra segments 404', async ({ page }) => {
  expect((await page.goto('/nope/home'))?.status()).toBe(404);
  expect((await page.goto(`/${PACK}/explorer/CONFORMED_GOLD/NOPE`))?.status()).toBe(404);
  expect((await page.goto(`/${PACK}/health/a/b`))?.status()).toBe(404);
});

test('health endpoint responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('persona switcher lists the five archetypes and switches identity', async ({ page }) => {
  await page.goto(`/${PACK}/home`);
  await page.getByTestId('persona-trigger').click();
  for (const a of ['A', 'B', 'C', 'D', 'E']) await expect(page.locator(`[data-persona="${a}"]`)).toBeVisible();
  await page.locator('[data-persona="E"]').click();
  await expect(page.getByTestId('persona-toast')).toContainText('Now viewing as');
  await expect(page.getByTestId('persona-trigger')).toContainText('· E');
});

for (const url of STUB_URLS) {
  test(`stub renders ${url}`, async ({ page }) => {
    expect((await page.goto(url))?.status()).toBe(200);
    await expect(page.locator('[data-stub]')).toBeVisible();
    await expect(page.getByTestId('synthetic-footer')).toBeVisible();
  });
}

for (const url of SCREEN_URLS) {
  test(`screen renders ${url}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    expect((await page.goto(url))?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('synthetic-footer')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
