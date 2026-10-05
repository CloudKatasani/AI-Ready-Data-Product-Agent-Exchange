import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeNavId, ALL_NAV_ITEMS, DOORS, packHref } from '@/components/shell/nav';
import { copy } from '@/copy/en';

const APP = join(process.cwd(), 'src/app');
const GROUPS = ['(consumer)', '(builder)', '(operator)', '(strategist)', '(presenter)'];

/** Every route from 01-functional-spec §3, mapped to its Next.js directory below `[pack]/(group)/`. */
const SPEC_ROUTES: Record<string, string> = {
  '/[pack]/home': 'home',
  '/[pack]/marketplace': 'marketplace',
  '/[pack]/marketplace/products/[id]': 'marketplace/products/[id]',
  '/[pack]/marketplace/agents/[id]': 'marketplace/agents/[id]',
  '/[pack]/ask/[agentId?]': 'ask/[[...agentId]]',
  '/[pack]/access': 'access',
  '/[pack]/request/new': 'request/new',
  '/[pack]/request/[id]': 'request/[id]',
  '/[pack]/studio': 'studio',
  '/[pack]/studio/[productId]/[stage?]': 'studio/[productId]/[[...stage]]',
  '/[pack]/factory': 'factory',
  '/[pack]/factory/[draftId]': 'factory/[draftId]',
  '/[pack]/explorer/[schema?]/[object?]': 'explorer/[[...path]]',
  '/[pack]/semantic/[view?]': 'semantic/[[...view]]',
  '/[pack]/glossary/[term?]': 'glossary/[[...term]]',
  '/[pack]/context/[section?]': 'context/[[...section]]',
  '/[pack]/health/[tab?]': 'health/[[...tab]]',
  '/[pack]/agent-quality/[tab?]': 'agent-quality/[[...tab]]',
  '/[pack]/cost-value': 'cost-value',
  '/[pack]/impact': 'impact',
  '/[pack]/audit': 'audit',
  '/[pack]/platform-map': 'platform-map',
  '/[pack]/why/knockout': 'why/knockout',
  '/[pack]/why/compare': 'why/compare',
  '/[pack]/readiness': 'readiness',
  '/[pack]/roadmap': 'roadmap',
  '/[pack]/portfolio': 'portfolio',
  '/[pack]/operating-model': 'operating-model',
  '/[pack]/admin': 'admin',
};

function pageExists(dir: string): boolean {
  return GROUPS.some((g) => existsSync(join(APP, '[pack]', g, dir, 'page.tsx')));
}

describe('route scaffold (01-functional-spec §3)', () => {
  it('has the launcher page', () => {
    expect(existsSync(join(APP, '(presenter)', 'launch', 'page.tsx'))).toBe(true);
  });

  it.each(Object.entries(SPEC_ROUTES))('%s has a page', (_route, dir) => {
    expect(pageExists(dir)).toBe(true);
  });

  it('every nav item points at a scaffolded page', () => {
    for (const item of ALL_NAV_ITEMS) {
      const dir = Object.values(SPEC_ROUTES).find((d) => d === item.path || d.startsWith(`${item.path}/[[...`));
      expect(dir, item.path).toBeDefined();
    }
  });
});

describe('door navigation', () => {
  it('has the five doors in IA order', () => {
    expect(DOORS.map((d) => d.id)).toEqual(['home', 'consume', 'build', 'run', 'strategy']);
  });

  it('every nav item has copy and a unique path', () => {
    const paths = ALL_NAV_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const item of ALL_NAV_ITEMS) expect(copy.nav[item.id]).toBeTruthy();
  });

  it.each([
    ['/p/home', 'home'],
    ['/p/marketplace/products/DP-1', 'marketplace'],
    ['/p/ask', 'ask'],
    ['/p/ask/AG-1', 'ask'],
    ['/p/request/new', 'request'],
    ['/p/request/42', 'request'],
    ['/p/studio/DP-1/3', 'studio'],
    ['/p/why/knockout', 'knockout'],
    ['/p/why/compare', 'compare'],
    ['/p/agent-quality/feedback', 'agentQuality'],
  ])('%s highlights %s', (pathname, id) => {
    expect(activeNavId(pathname)).toBe(id);
  });

  it('returns undefined outside the nav', () => {
    expect(activeNavId('/p/nowhere')).toBeUndefined();
  });

  it('encodes the pack id in hrefs', () => {
    expect(packHref('a b', 'home')).toBe('/a%20b/home');
  });
});
