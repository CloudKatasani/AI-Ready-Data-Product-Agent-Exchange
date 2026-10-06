/**
 * Validator categories 7 (Scenarios) and 8 (Agents) — 04 §7. Runs every scenario through the scripted
 * engine (and so through QueryService); checks expectations, persona variants, paraphrases, pattern
 * coverage, KPI values against target bands, agent coverage and scripted pass rates.
 */
import type { Pack, Rubrics } from '@/lib/packs/schema';
import { type CheckResult, Checks } from '@/lib/packs/validate';
import { systemPrincipal } from '@/lib/query/principal';
import type { QueryService } from '@/lib/query/query-service';
import { GOLDEN_ARCHETYPE, personaFor, roundCell } from './golden';
import { matcherFor, respondScripted } from './scripted/respond';

/** How far outside its target band a KPI may land and still pass (fraction of the band, min 10% of |max|). */
export function kpiTolerance(target: { min: number; max: number }): number {
  return Math.max(Math.abs(target.max - target.min), 0.1 * Math.abs(target.max));
}

export async function scenarioChecks(pack: Pack, rubrics: Rubrics, qs: QueryService, results: CheckResult[] = []): Promise<CheckResult[]> {
  const c = new Checks(results, 7);
  const a8 = c.in(8);
  const deps = { pack, rubrics, qs, matcher: matcherFor(pack) };
  const passed = new Map<string, { ok: number; n: number }>();

  for (const s of pack.scenarios) {
    let a;
    try {
      a = await respondScripted(s.agent, s.question, { ...deps, who: personaFor(pack, GOLDEN_ARCHETYPE) });
    } catch (e) {
      c.expect(false, 'scenario.runs', `${s.id}: ${(e as Error).message}`, s.id);
      continue;
    }
    let ok = c.expect(a.kind === s.kind, 'scenario.kind', `${s.id}: expected ${s.kind}, scripted engine answered ${a.kind}`, s.id);
    ok = c.expect(a.scenarioId === s.id, 'scenario.matches', `${s.id}: question matched ${a.scenarioId ?? 'no scenario'}`, s.id) && ok;
    if (s.kind === 'answer') {
      ok = c.expect(Boolean(a.result), 'scenario.compiles', `${s.id}: no governed result (${a.headline})`, s.id) && ok;
      ok = c.expect(!/\{\{/.test(a.headline + a.narrative), 'scenario.template', `${s.id}: unresolved template placeholder`, s.id) && ok;
      ok = c.expect(a.citations.length > 0, 'scenario.cited', `${s.id}: answer has no citations`, s.id) && ok;
      const r = a.result;
      if (r && s.expect.rows !== undefined) ok = c.expect(r.rows.length === s.expect.rows, 'scenario.expect.rows', `${s.id}: expected ${s.expect.rows} rows, got ${r.rows.length}`, s.id) && ok;
      if (r && s.expect.top) {
        for (const [col, want] of Object.entries(s.expect.top)) {
          const i = r.columns.findIndex((x) => x.name === col);
          const got = i >= 0 ? roundCell(r.rows[0]?.[i]) : undefined;
          ok = c.expect(String(got) === String(want), 'scenario.expect.top', `${s.id}: expected top ${col} = ${String(want)}, got ${String(got)}`, s.id) && ok;
        }
      }
      for (const rule of s.expect.rules ?? []) ok = c.expect(a.rules.includes(rule), 'scenario.expect.rules', `${s.id}: rule ${rule} was not applied`, s.id) && ok;
      if (r && s.expect.certified !== undefined) {
        const certified = r.sources.every((x) => x.certified);
        ok = c.expect(certified === s.expect.certified, 'scenario.expect.certified', `${s.id}: expected certified=${s.expect.certified}`, s.id) && ok;
      }
    }
    for (const [arch, exp] of Object.entries(s.personas_expect)) {
      const b = await respondScripted(s.agent, s.question, { ...deps, who: personaFor(pack, arch) });
      if (exp.kind) c.expect(b.kind === exp.kind, 'scenario.persona.kind', `${s.id} as ${arch}: expected ${exp.kind}, got ${b.kind}`, s.id);
      if (exp.rowFiltered !== undefined) c.expect(b.result?.rowFiltered === exp.rowFiltered, 'scenario.persona.row_filter', `${s.id} as ${arch}: expected rowFiltered=${exp.rowFiltered}`, s.id);
      for (const col of exp.masked ?? []) c.expect(Boolean(b.result?.maskedColumns.includes(col)), 'scenario.persona.masked', `${s.id} as ${arch}: expected ${col} masked`, s.id);
    }
    for (const p of s.paraphrases) {
      const b = await respondScripted(s.agent, p, { ...deps, who: personaFor(pack, GOLDEN_ARCHETYPE) });
      c.warn(b.scenarioId === s.id, 'scenario.paraphrase', `${s.id}: paraphrase "${p}" matched ${b.scenarioId ?? b.kind}`, s.id);
    }
    const tally = passed.get(s.agent) ?? { ok: 0, n: 0 };
    passed.set(s.agent, { ok: tally.ok + (ok ? 1 : 0), n: tally.n + 1 });
  }

  if (pack.manifest.depth === 'deep') {
    const patterns = new Set(pack.scenarios.map((s) => s.pattern));
    for (let p = 1; p <= 15; p++) c.expect(patterns.has(p), 'scenario.pattern_coverage', `No scenario covers pattern ${p}`, `pattern ${p}`);
  }

  const who = systemPrincipal(pack);
  for (const k of pack.kpis) {
    const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === k.metric));
    if (!view) continue;
    try {
      const r = await qs.run({ kind: 'metric', query: { view: view.name, metrics: [k.metric], ...(view.time_dimensions.length && Object.keys(k.window).length ? { timeRange: k.window } : {}) }, purpose: 'eval' }, who);
      const v = Number(r.rows[0]?.[0]);
      const tol = kpiTolerance(k.target);
      c.expect(Number.isFinite(v) && v >= k.target.min - tol && v <= k.target.max + tol, 'kpi.in_target_range', `${k.id} = ${v} is outside ${k.target.min}–${k.target.max} ± ${tol}`, k.id);
    } catch (e) {
      c.expect(false, 'kpi.in_target_range', `${k.id}: ${(e as Error).message}`, k.id);
    }
  }

  // Category 8 — agents.
  for (const ag of pack.agents) {
    const bound = new Set(ag.products.map((b) => b.id));
    const toolViews = new Set(ag.tools.flatMap((t) => (t.tool === 'semantic_query' ? t.views : [])));
    for (const cov of ag.kpi_coverage) {
      const kpi = pack.kpis.find((k) => k.id === cov.kpi);
      const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === kpi?.metric));
      a8.expect(Boolean(kpi?.products.some((p) => bound.has(p))), 'agent.coverage_bound', `${ag.id} covers ${cov.kpi} but binds none of its products`, ag.id);
      a8.expect(Boolean(view && toolViews.has(view.name)), 'agent.coverage_view', `${ag.id} covers ${cov.kpi} but cannot query ${view?.name ?? 'its view'}`, ag.id);
      for (const s of cov.slices) a8.expect(Boolean(view?.dimensions.some((d) => d.name === s)), 'agent.coverage_slice', `${ag.id} slice ${s} is not a dimension of ${view?.name}`, ag.id);
    }
    const mine = pack.scenarios.filter((s) => s.agent === ag.id);
    if (ag.status === 'PRODUCTION') a8.expect(mine.length >= 4, 'agent.min_scenarios', `${ag.id} has ${mine.length} scenarios (production agents need ≥ 4)`, ag.id);
    for (const sid of ag.scenarios) a8.expect(pack.scenarios.find((s) => s.id === sid)?.agent === ag.id, 'agent.scenario_owner', `${ag.id} lists ${sid}, which belongs to another agent`, ag.id);
    const t = passed.get(ag.id);
    if (t && t.n) a8.expect(t.ok / t.n >= ag.eval.golden_min, 'agent.scripted_eval', `${ag.id} scripted golden pass rate ${t.ok}/${t.n} is below ${ag.eval.golden_min}`, ag.id);
  }
  return results;
}
