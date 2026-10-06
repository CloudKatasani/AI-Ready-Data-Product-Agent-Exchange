import { ALL_NAV_ITEMS } from '../../src/components/shell/nav';

export const PACK = 'utilities';

/** Screens built so far (no stub). */
export const BUILT = new Set(['home', 'ask', 'marketplace', 'access', 'request', 'studio', 'factory', 'explorer', 'semantic', 'glossary', 'context', 'health', 'agentQuality', 'costValue', 'impact', 'audit']);

/** Scaffolded routes that still render the Phase 0 stub. */
export const STUB_URLS: string[] = [
  ...ALL_NAV_ITEMS.filter((i) => !BUILT.has(i.id)).map((i) => `/${PACK}/${i.path}`),
];

/** Built screens (Phases 2–7). */
export const SCREEN_URLS: string[] = [
  `/${PACK}/health`,
  `/${PACK}/health/incidents`,
  `/${PACK}/agent-quality`,
  `/${PACK}/agent-quality/feedback`,
  `/${PACK}/cost-value`,
  `/${PACK}/cost-value?tab=value`,
  `/${PACK}/cost-value?lag=0.25&wh=L&q=900&price=3`,
  `/${PACK}/impact`,
  `/${PACK}/impact?object=CONFORMED_GOLD.FCT_OUTAGE&column=customer_minutes&change=rename`,
  `/${PACK}/audit`,
  `/${PACK}/audit?actor=HUMAN`,
  `/${PACK}/audit?tab=lineage`,
  `/${PACK}/factory`,
  `/${PACK}/studio`,
  `/${PACK}/studio?view=table`,
  `/${PACK}/studio/DP-UTL-005`,
  `/${PACK}/studio/DP-UTL-005/5`,
  `/${PACK}/studio/DP-UTL-007`,
  `/${PACK}/studio/DP-UTL-002/3`,
  `/${PACK}/request/new`,
  `/${PACK}/request/REQ-UTL-001`,
  `/${PACK}/marketplace`,
  `/${PACK}/marketplace?tab=demand`,
  `/${PACK}/marketplace?tab=mesh`,
  `/${PACK}/marketplace?tab=compare&compare=DP-UTL-002&compare=DP-UTL-004`,
  `/${PACK}/marketplace?q=outage%20minutes`,
  `/${PACK}/marketplace/products/DP-UTL-002`,
  `/${PACK}/marketplace/products/DP-UTL-002?tab=contract`,
  `/${PACK}/marketplace/products/DP-UTL-002?tab=schema`,
  `/${PACK}/marketplace/products/DP-UTL-002?tab=quality`,
  `/${PACK}/marketplace/products/DP-UTL-002?tab=lineage`,
  `/${PACK}/marketplace/products/DP-UTL-002?tab=value`,
  `/${PACK}/marketplace/agents/AG-UTL-002`,
  `/${PACK}/marketplace/agents/AG-UTL-002?tab=coverage`,
  `/${PACK}/access`,
  `/${PACK}/home`,
  `/${PACK}/ask`,
  `/${PACK}/ask/AG-UTL-002`,
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
