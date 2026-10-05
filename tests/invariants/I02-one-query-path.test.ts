import { describe, it } from 'vitest';

// CLAUDE.md §4.2 — One governed query path. Implemented in Phase 2.
describe('I02 one governed query path', () => {
  it.todo('no module other than src/lib/warehouse/duckdb.ts imports @duckdb/node-api (eslint no-restricted-imports + source scan)');
  it.todo('every QueryService.run() call writes exactly one QueryLog row');
  it.todo('QueryService.run() applies entitlements, row access, masking, incident effects and row limits for the principal');
  it.todo('preview, worksheet, playground, agent and marketplace sample requests all route through QueryService.run()');
});
