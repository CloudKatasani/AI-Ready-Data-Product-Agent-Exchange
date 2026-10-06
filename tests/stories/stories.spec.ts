import { expect, type Locator, type Page, test } from '@playwright/test';
import { getPack, getStories, listPackIds } from '../../src/lib/packs/registry';
import { resolveStory } from '../../src/lib/presenter/stories';

/**
 * 09 §5 / AC1.5: every story, every deep pack — the presenter overlay's Go lands on the documented route as
 * the documented persona, and the step's landing-observable `expect` holds. Expectations that need the
 * presenter's clicks first (certify, grant, release…) are covered by the feature suites named in the
 * Phase 9 report; here the cheap ones are performed.
 */
const deep = listPackIds().filter((id) => {
  try {
    return getPack(id).manifest.depth === 'deep';
  } catch {
    return false;
  }
});

async function openOverlay(page: Page, storyId: string) {
  await page.getByTestId('presenter-open').click();
  await page.getByTestId('presenter-story').selectOption(storyId);
}

async function landing(page: Page, expectBlock: Record<string, unknown>) {
  const has = (k: string) => k in expectBlock;
  const main: Locator = page.locator('#main');
  if (has('layersShown')) await expect(page.getByTestId('platform-layers').locator('> li')).toHaveCount(9);
  if (has('band')) await expect(page.getByTestId('readiness-overall')).not.toHaveAttribute('data-score', '');
  if (has('gaps')) expect(await page.getByTestId('readiness-gaps').locator('li').count()).toBeGreaterThanOrEqual(Number(expectBlock.gaps));
  if (has('phases')) expect(await page.getByTestId('roadmap-gantt').locator('[data-phase]').count()).toBeGreaterThanOrEqual(3);
  if (has('raciShown')) await expect(page.getByTestId('raci')).toBeVisible();
  if (has('maturityShown')) await expect(page.getByTestId('maturity').locator('li')).toHaveCount(6);
  if (has('simulated')) {
    await page.getByTestId('simulate').click();
    await expect(page.getByTestId('coverage')).toHaveAttribute('data-weeks', '4');
  }
  if (has('answerKind') && page.url().includes('/home')) {
    await page.getByTestId('hero-submit').click();
    const card = page.getByTestId('answer-card').first();
    await expect(card).toHaveAttribute('data-kind', String(expectBlock.answerKind));
    if (has('rowFiltered')) await expect(card.locator('[data-banner="row_filtered"]')).toBeVisible();
  }
  if (has('deltaShown')) {
    await page.locator('[data-layer="context"]').check();
    await page.getByTestId('knockout-apply').click();
    const selected = page.locator('[data-selected="true"][data-answer]');
    await expect(selected).not.toHaveAttribute('data-delta', '0');
    await expect(selected).not.toHaveAttribute('data-confidence', 'trusted');
  }
  if (has('contractBump')) await expect(page.getByTestId('impact-result')).toHaveAttribute('data-bump', String(expectBlock.contractBump));
  if (has('costPerAnswerShown')) await expect(page.getByTestId('cost-by-agent')).toBeVisible();
  await expect(main).toBeVisible();
}

for (const packId of deep) {
  for (const s of getStories()) {
    test(`AC1.5 ${s.id} on ${packId}: every Go lands on the documented state`, async ({ page }) => {
      test.setTimeout(180_000);
      const story = resolveStory(getPack(packId), s.id);
      if (!story) throw new Error('story');
      await page.goto(`/${packId}/home`);
      await openOverlay(page, s.id);
      for (const step of story.steps) {
        const overlay = page.getByTestId('presenter-overlay');
        if (!(await overlay.isVisible())) await openOverlay(page, s.id);
        await overlay.getByTestId(`go-${step.id}`).click();
        const want = new URL(step.href, 'http://x');
        // The documented state: same path and every state parameter (a step may stay on the same path).
        await page.waitForURL((u) => u.pathname === want.pathname && [...want.searchParams].every(([k, v]) => u.searchParams.get(k) === v), { timeout: 15_000 });
        const archetype = s.steps.find((x) => x.id === step.id)?.go.persona ?? '';
        await expect(page.getByTestId('persona-trigger')).toContainText(`· ${archetype}`);
        await expect(page.getByTestId('presenter-overlay')).toHaveAttribute('data-step', step.id);
        await landing(page, s.steps.find((x) => x.id === step.id)?.expect ?? {});
      }
    });
  }
}
