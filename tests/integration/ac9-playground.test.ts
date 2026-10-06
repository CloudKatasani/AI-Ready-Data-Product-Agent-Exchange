import { describe, expect, it } from 'vitest';
import { headlineTiles } from '@/lib/presenter/home';
import { playgroundQuery, rangeKeyFor } from '@/lib/presenter/playground';
import { pack, persona, service } from '../setup/query';

// AC9.1 / AC2.1: the Playground value for each headline KPI equals the KPI tile value (same compiled query).
// Phase 3 extends this to the agent's golden answer.
describe('AC9.1 Playground = KPI tile for every headline KPI', () => {
  it.each(pack.manifest.home.headlineKpis)('%s', async (kpiId) => {
    const kpi = pack.kpis.find((k) => k.id === kpiId);
    if (!kpi) throw new Error(kpiId);
    const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === kpi.metric));
    if (!view) throw new Error(kpi.metric);
    const range = rangeKeyFor(kpi.window);
    expect(range, `no Playground range for ${JSON.stringify(kpi.window)}`).toBeDefined();
    const pg = playgroundQuery(view, { metric: kpi.metric, range });
    expect(pg).not.toBeNull();
    const { qs } = await service();
    const tile = await qs.run({ kind: 'metric', query: { view: view.name, metrics: [kpi.metric], timeRange: kpi.window }, purpose: 'kpi-tile' }, persona('E'));
    const play = await qs.run({ kind: 'metric', query: pg as NonNullable<typeof pg>, purpose: 'playground' }, persona('E'));
    // Same compiled SQL; DuckDB's parallel float aggregation may differ in the last bit between runs.
    expect(Number(play.rows[0]?.[0])).toBeCloseTo(Number(tile.rows[0]?.[0]), 9);
    expect(play.sql).toBe(tile.sql);
  });
});

// AC2.1 — the Home tile (headlineTiles, the code the Home page renders) equals the Playground value.
describe('AC2.1 Home KPI tiles = Semantic Playground', () => {
  it('every headline tile value equals the Playground query for its KPI window', async () => {
    const { qs } = await service();
    const tiles = await headlineTiles(pack, qs, persona('E'));
    expect(tiles.map((t) => t.kpiId)).toEqual(pack.manifest.home.headlineKpis);
    for (const t of tiles) {
      const kpi = pack.kpis.find((k) => k.id === t.kpiId);
      const view = pack.semantic.find((v) => v.name === t.view);
      if (!kpi || !view) throw new Error(t.kpiId);
      const pg = playgroundQuery(view, { metric: kpi.metric, range: rangeKeyFor(kpi.window) });
      const play = await qs.run({ kind: 'metric', query: pg as NonNullable<typeof pg>, purpose: 'playground' }, persona('E'));
      expect(Number(t.value)).toBeCloseTo(Number(play.rows[0]?.[0]), 9);
      expect(t.spark.length).toBeGreaterThan(1);
    }
  });
});
