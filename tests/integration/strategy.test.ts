import { describe, expect, it } from 'vitest';
import { getPack, getRubrics, listPackIds } from '@/lib/packs/registry';
import { KNOCKOUT_LAYERS } from '@/lib/packs/schema';
import { compare, knockout, maturity, overridePriority, portfolio, saveAssessment, assessments } from '@/lib/presenter/strategy';
import { principalFor } from '@/lib/query/principal';
import { flowPath, platformLayers } from '@/lib/strategy/platform';
import { ACTIVITIES, raciFor, STYLES } from '@/lib/strategy/raci';
import { bandOf, DIMENSIONS, dimScore, overallScore, PRESETS, rankGaps } from '@/lib/strategy/readiness';
import { layout, PHASES, phaseFromGaps } from '@/lib/strategy/roadmap';

const deep = listPackIds().filter((id) => {
  try {
    return getPack(id).manifest.depth === 'deep';
  } catch {
    return false;
  }
});
const steward = (packId: string) => {
  const pack = getPack(packId);
  return principalFor(pack, pack.personas.find((p) => p.archetype === 'D')?.id ?? '');
};

describe.each(deep)('Knockout — %s', (packId) => {
  it('AC11.1 turning off Context changes the flagged KPI by the declared delta', async () => {
    const pack = getPack(packId);
    const flagged = pack.knockout.answers.find((a) => a.kpi === pack.manifest.story_roles.knockoutKpi);
    expect(flagged).toBeTruthy();
    const r = (await knockout(packId, steward(packId), ['context'])).find((x) => x.id === flagged?.id);
    const declared = (flagged?.declared_delta_pct as Record<string, number>).context;
    expect(declared).toBeDefined();
    expect(r?.deltaPct).not.toBeNull();
    expect(Math.abs((r?.deltaPct ?? NaN) - (declared ?? NaN))).toBeLessThanOrEqual(0.1);
    expect(r?.failures.map((f) => f.layer)).toEqual(['context']);
    expect(r?.confidence).not.toBe('trusted');
  }, 60_000);

  it('every declared single-layer delta matches the computed knockout (and nothing undeclared computes)', async () => {
    const pack = getPack(packId);
    for (const layer of KNOCKOUT_LAYERS) {
      const results = await knockout(packId, steward(packId), [layer]);
      for (const a of pack.knockout.answers) {
        const declared = (a.declared_delta_pct as Record<string, number>)[layer];
        const got = results.find((x) => x.id === a.id)?.deltaPct ?? null;
        if (declared === undefined) expect(got, `${a.id} ${layer}`).toBeNull();
        else expect(Math.abs((got ?? NaN) - declared), `${a.id} ${layer}`).toBeLessThanOrEqual(0.1);
      }
    }
  }, 120_000);

  it('governance off is flagged unsafe and recorded as a knockout policy; all-on is trusted with no failures', async () => {
    const off = await knockout(packId, steward(packId), ['governance']);
    for (const r of off) {
      expect(r.confidence).toBe('unsafe');
      expect(r.policies.some((p) => p.kind === 'knockout' && p.target === 'governance')).toBe(true);
    }
    const on = await knockout(packId, steward(packId), []);
    for (const r of on) {
      expect(r.failures).toEqual([]);
      expect(r.deltaPct).toBe(0);
      expect(r.value).not.toBeNull();
    }
  }, 60_000);
});

describe('Compare', () => {
  it('pairs each governed answer with the raw-stack answer and its SQL', async () => {
    const rows = await compare('utilities', steward('utilities'));
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.governed.displaySql).toBeTruthy();
      expect(r.raw?.confidence).toBe('unsafe');
      expect(r.raw?.failures.length).toBeGreaterThan(1);
    }
  }, 60_000);
});

describe('AC11.2 Readiness — the ported engine reproduces the predecessor fixtures', () => {
  // Computed by AI-Ready `ext/readiness.ts` (dimension ai_ops was `aiops` there).
  const FIXTURES = {
    early: { overall: 1.3, band: 'Exploring', dims: { foundation: 1.7, modelling: 1.7, semantics: 1, vocabulary: 1.3, context: 1, governance: 1.7, ai_ops: 1 }, topGaps: ['semantics', 'vocabulary', 'context'] },
    mid: { overall: 2.1, band: 'Foundational', dims: { foundation: 3.3, modelling: 3, semantics: 1.7, vocabulary: 1.7, context: 1.3, governance: 2.3, ai_ops: 1.3 }, topGaps: ['semantics', 'vocabulary', 'context'] },
    advanced: { overall: 3.5, band: 'Operational', dims: { foundation: 4.3, modelling: 4, semantics: 3.3, vocabulary: 3.3, context: 3, governance: 3.7, ai_ops: 2.7 }, topGaps: ['ai_ops', 'context', 'semantics'] },
  } as const;
  const rubrics = getRubrics();
  it.each(PRESETS.map((p) => [p.id, p] as const))('%s preset', (id, p) => {
    const f = FIXTURES[id];
    const overall = overallScore(p.answers);
    expect(overall).toBe(f.overall);
    expect(bandOf(rubrics, overall ?? 0)).toBe(f.band);
    for (const d of DIMENSIONS) expect(dimScore(d.id, p.answers)).toBe(f.dims[d.id]);
    expect(rankGaps(rubrics, p.answers).slice(0, 3).map((g) => g.dim)).toEqual(f.topGaps);
  });
  it('bands follow the ported boundaries', () => {
    expect([1.9, 2.0, 2.9, 3.0, 4.5, 4.6, 5].map((s) => bandOf(rubrics, s))).toEqual(['Exploring', 'Foundational', 'Foundational', 'Operational', 'AI-ready', 'AI-native', 'AI-native']);
  });
  it('a saved assessment stores its scores and band', async () => {
    const early = PRESETS.find((p) => p.id === 'early');
    const pack = getPack('utilities');
    await saveAssessment('utilities', 'Workshop baseline', early?.answers ?? {}, pack.personas[0]?.id ?? '');
    const saved = (await assessments('utilities')).find((a) => a.name === 'Workshop baseline');
    expect(saved?.band).toBe('Exploring');
    expect(saved?.scores.overall).toBe(1.3);
  });
});

describe('Roadmap, operating model, platform map', () => {
  it('roadmap phases lay end to end and generate from readiness gaps', () => {
    const placed = layout();
    expect(placed[0]?.start).toBe(0);
    for (let i = 1; i < placed.length; i++) expect(placed[i]?.start).toBe((placed[i - 1]?.start ?? 0) + (placed[i - 1]?.length ?? 0));
    expect(phaseFromGaps(['semantics', 'vocabulary', 'context']).phase).toBe(PHASES.find((p) => p.readinessDims.includes('semantics'))?.id);
  });
  it('every activity has exactly one accountable role in every operating style', () => {
    for (const { id } of STYLES) {
      const rows = raciFor(id);
      expect(rows).toHaveLength(ACTIVITIES.length);
      for (const [name, , , cells] of rows) expect(Object.values(cells).filter((v) => v === 'A' || v === 'A/R').length, `${id}: ${name}`).toBe(1);
    }
  });
  it.each(deep)('%s: nine layers with contents, and a flow path from Bronze to an agent', (packId) => {
    const pack = getPack(packId);
    const layers = platformLayers(pack);
    expect(layers.map((l) => l.layer)).toEqual(['bronze', 'silver', 'gold', 'semantic', 'glossary', 'context', 'product', 'agent', 'governance']);
    for (const l of layers) expect(l.count).toBeGreaterThan(0);
    const path = flowPath(pack);
    expect(path[0]?.layer).toBe('bronze');
    expect(path.at(-1)?.layer).toBe('agent');
  });
});

describe('Portfolio and maturity', () => {
  it('scores every product, and a human override with a reason re-ranks it', async () => {
    const before = await portfolio('utilities', 'WSJF');
    expect(before).toHaveLength(getPack('utilities').products.length);
    const last = before.at(-1);
    const pack = getPack('utilities');
    await overridePriority('utilities', last?.item.id ?? '', 'WSJF', (before[0]?.final ?? 0) + 10, 'Regulator deadline moved forward', pack.personas.find((p) => p.archetype === 'B')?.id ?? '');
    const after = await portfolio('utilities', 'WSJF');
    expect(after[0]?.item.id).toBe(last?.item.id);
    expect(after[0]?.override?.reason).toBe('Regulator deadline moved forward');
    await expect(overridePriority('utilities', last?.item.id ?? '', 'WSJF', 1, '  ', 'x')).rejects.toThrow(/reason/);
  });
  it('maturity levels are derived from estate evidence on a 1–5 scale', async () => {
    const m = await maturity('utilities');
    expect(m.levels).toHaveLength(6);
    for (const l of m.levels) expect(l.level).toBeGreaterThanOrEqual(1);
    expect(m.overall).toBeGreaterThan(1);
  });
});
