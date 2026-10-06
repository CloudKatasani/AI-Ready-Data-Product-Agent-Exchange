import { ALL_NAV_ITEMS } from '../../src/components/shell/nav';

export const PACK = 'utilities';

/** Screens built so far (no stub). */
export const BUILT = new Set(['explorer', 'semantic', 'glossary', 'context']);

/** Scaffolded routes that still render the Phase 0 stub. */
export const STUB_URLS: string[] = [
  ...ALL_NAV_ITEMS.filter((i) => !BUILT.has(i.id)).map((i) => `/${PACK}/${i.path}`),
  `/${PACK}/marketplace/products/DP-UTL-002`,
  `/${PACK}/marketplace/agents/AG-UTL-002`,
  `/${PACK}/ask/AG-UTL-002`,
  `/${PACK}/request/REQ-UTL-001`,
  `/${PACK}/studio/DP-UTL-005`,
  `/${PACK}/studio/DP-UTL-005/11`,
  `/${PACK}/factory/draft-1`,
  `/${PACK}/health/incidents`,
  `/${PACK}/agent-quality/feedback`,
];

/** Built screens (Phase 2). */
export const SCREEN_URLS: string[] = [
  `/${PACK}/explorer`,
  `/${PACK}/explorer/worksheet`,
  `/${PACK}/explorer/CURATED_SILVER/CUSTOMER`,
  `/${PACK}/explorer/CONFORMED_GOLD/FCT_OUTAGE?tab=columns`,
  `/${PACK}/explorer/CONFORMED_GOLD/FCT_OUTAGE?tab=ddl`,
  `/${PACK}/explorer/CONFORMED_GOLD/FCT_OUTAGE?tab=lineage`,
  `/${PACK}/explorer/CONFORMED_GOLD/FCT_OUTAGE?tab=quality`,
  `/${PACK}/explorer/CONFORMED_GOLD/FCT_OUTAGE?tab=governance`,
  `/${PACK}/semantic`,
  `/${PACK}/semantic/RELIABILITY`,
  `/${PACK}/semantic/RELIABILITY?tab=metrics`,
  `/${PACK}/semantic/RELIABILITY?tab=verified`,
  `/${PACK}/semantic/RELIABILITY?tab=yaml`,
  `/${PACK}/semantic/RELIABILITY?tab=playground&metric=saidi&dim=region&range=last-quarter`,
  `/${PACK}/glossary`,
  `/${PACK}/glossary/GT-UTL-SAIDI`,
  `/${PACK}/context`,
  `/${PACK}/context/rules`,
  `/${PACK}/context/verified`,
  `/${PACK}/context/synonyms`,
  `/${PACK}/context/documents?q=major%20event%20days`,
];
