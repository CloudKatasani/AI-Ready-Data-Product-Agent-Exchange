import { ALL_NAV_ITEMS } from '../../src/components/shell/nav';

/** Pack id used to browse the scaffold before packs exist (Phase 0). */
export const SHELL_PACK = 'sample';

/** One concrete URL per scaffolded route, including detail and optional-segment variants. */
export const SCAFFOLD_URLS: string[] = [
  ...ALL_NAV_ITEMS.map((i) => `/${SHELL_PACK}/${i.path}`),
  `/${SHELL_PACK}/marketplace/products/DP-X-001`,
  `/${SHELL_PACK}/marketplace/agents/AG-X-001`,
  `/${SHELL_PACK}/ask/AG-X-001`,
  `/${SHELL_PACK}/request/REQ-1`,
  `/${SHELL_PACK}/studio/DP-X-001`,
  `/${SHELL_PACK}/studio/DP-X-001/3`,
  `/${SHELL_PACK}/factory/draft-1`,
  `/${SHELL_PACK}/explorer/GOLD/OBJECT_A`,
  `/${SHELL_PACK}/semantic/view_a`,
  `/${SHELL_PACK}/glossary/GT-X-1`,
  `/${SHELL_PACK}/context/rules`,
  `/${SHELL_PACK}/health/incidents`,
  `/${SHELL_PACK}/agent-quality/feedback`,
];
