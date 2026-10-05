import { describe, it } from 'vitest';

// CLAUDE.md §4.3 — One metric compiler. Implemented in Phase 2.
describe('I03 one metric compiler', () => {
  it.todo('compileMetricQuery() is the only producer of metric SQL (no other module builds SELECT … FROM semantic sources)');
  it.todo('the same MetricQuery yields byte-identical SQL and identical values across Explorer, Playground, KPI tile, agent and knockout baseline');
});
