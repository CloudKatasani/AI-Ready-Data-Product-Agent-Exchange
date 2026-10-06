import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { productCard } from '@/lib/marketplace/catalog';
import { duplicateCandidates } from '@/lib/marketplace/demand';
import { blastRadius, dataMesh } from '@/lib/marketplace/mesh';
import { searchCatalog } from '@/lib/marketplace/search';
import { catalogState } from '@/lib/presenter/marketplace';
import { pack, persona, rubrics } from '../setup/query';

describe('AC3.2 — search finds governed things by business phrasing', () => {
  it('"outage minutes" returns the reliability product and the SAIDI KPI via synonym', () => {
    const hits = searchCatalog(pack, 'outage minutes');
    const products = hits.filter((h) => h.kind === 'product').map((h) => h.id);
    const kpis = hits.filter((h) => h.kind === 'kpi').map((h) => h.id);
    expect(products[0]).toBe('DP-UTL-002');
    expect(kpis).toContain('KPI-UTL-SAIDI');
  });

  it.each([
    ['tree trimming', 'DP-UTL-007'],
    ['days sales outstanding', 'DP-UTL-005'],
    ['maverick spend', 'DP-UTL-006'],
  ])('"%s" ranks %s first among products', (q, id) => {
    expect(searchCatalog(pack, q).filter((h) => h.kind === 'product')[0]?.id).toBe(id);
  });
});

describe('AC3.3 — quality ring = latest QualityScoreSnapshot', () => {
  it('every scored product card shows its latest snapshot, including a newly written one', async () => {
    const prisma = db();
    await prisma.qualityScoreSnapshot.create({ data: { productId: 'DP-UTL-007', score: 87.25, dimensionsJson: '{}', rubricVersion: rubrics.version } });
    const who = persona('B');
    const state = await catalogState(pack, who.personaId);
    for (const p of pack.products) {
      const latest = await prisma.qualityScoreSnapshot.findFirst({ where: { productId: p.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      expect(productCard(pack, rubrics, p, state, who).quality?.score ?? null).toBe(latest?.score ?? null);
    }
    expect(state.quality.get('DP-UTL-007')?.score).toBe(87.25);
  });
});

describe('mesh, blast radius and demand duplicates', () => {
  it('links products that share upstream objects; blast radius of a gold table reaches agents and KPIs', () => {
    const mesh = dataMesh(pack);
    expect(mesh.edges.some((e) => [e.source, e.target].sort().join() === 'DP-UTL-002,DP-UTL-004')).toBe(true);
    const r = blastRadius(pack, 'CONFORMED_GOLD.DIM_FEEDER');
    expect(r.products).toEqual(expect.arrayContaining(['DP-UTL-002', 'DP-UTL-004', 'DP-UTL-007']));
    expect(r.agents).toContain('AG-UTL-002');
    expect(r.kpis).toContain('KPI-UTL-SAIDI');
  });

  it('a near-duplicate need surfaces the existing reliability product', () => {
    const d = duplicateCandidates(pack, rubrics, 'Regional reliability scorecard: SAIDI by region and the feeders with the most outage minutes');
    expect(d.slice(0, 2).map((x) => x.id)).toContain('DP-UTL-002');
    expect(d[0]?.similarity).toBeGreaterThanOrEqual(rubrics.intake.duplicate_similarity * 0.5);
  });
});
