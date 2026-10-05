import { describe, it } from 'vitest';

// CLAUDE.md §4.1 — Pack-driven, engine-generic. Implemented in Phase 1.
describe('I01 pack-driven, engine-generic', () => {
  it.todo('no term from any installed pack (industry, company, KPI, column, entity names) appears in src/ — scripts/lint/no-domain-strings.ts reports zero violations');
  it.todo('the lint fails when a pack term is planted in a src/ fixture file');
  it.todo('every UI module reads industry content through getPack(), never from literals');
});
