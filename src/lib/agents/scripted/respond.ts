/**
 * Scripted engine (08 §3): guardrails → scenario match (TF-IDF) / redirect / clarify → coverage planner →
 * governed execution (QueryService) → templated, cited answer with a 7-step trace. Deterministic: no
 * clock and no randomness in the content; timings are measured but excluded from golden files.
 */
import { searchDocuments } from '@/lib/packs/doc-search';
import type { AgentManifest, MetricQuery, Pack, Rubrics } from '@/lib/packs/schema';
import { CompileError } from '@/lib/query/compiler';
import { IncidentBlocked } from '@/lib/query/incidents';
import type { QueryService } from '@/lib/query/query-service';
import { PolicyDenied, type GovernedResult, type Principal } from '@/lib/query/types';
import type { AgentAnswer, Banner, Citation, Confidence, TraceStep } from '../types';
import { checkGuardrails } from './guardrails';
import { Matcher } from './matcher';
import { describeQuery, detectKpi, metricMentioned, plan } from './planner';
import { verifiedMatcherFor } from './verified';
import { renderTemplate } from './template';
import { mentions } from './text';

export interface RespondDeps {
  pack: Pack;
  rubrics: Rubrics;
  qs: QueryService;
  who: Principal;
  matcher?: Matcher;
}

const matchers = new WeakMap<Pack, Matcher>();
export function matcherFor(pack: Pack): Matcher {
  let m = matchers.get(pack);
  if (!m) matchers.set(pack, (m = new Matcher(pack)));
  return m;
}

class Clock {
  private t = performance.now();
  lap(): number {
    const now = performance.now();
    const ms = Math.max(0, Math.round(now - this.t));
    this.t = now;
    return ms;
  }
}

function step(id: TraceStep['id'], label: string, layer: string, ms: number, detail: string, refs: string[] = [], status: TraceStep['status'] = 'ok'): TraceStep {
  return { id, label, layer, status, ms, refs, detail };
}

function textAnswer(agent: AgentManifest, question: string, kind: AgentAnswer['kind'], headline: string, narrative: string, trace: TraceStep[], extra: Partial<AgentAnswer> = {}): AgentAnswer {
  return { kind, agentId: agent.id, question, mode: 'scripted', headline, narrative, chart: { type: 'none' }, citations: [], confidence: 'trusted', banners: [], followups: [], trace, rules: [], latencyMs: 0, ...extra };
}

function coverageFollowups(pack: Pack, agent: AgentManifest, q: MetricQuery | undefined): string[] {
  const kpi = pack.kpis.find((k) => q?.metrics.includes(k.metric));
  const cov = agent.kpi_coverage.find((c) => c.kpi === kpi?.id);
  if (!cov || !kpi) return [];
  const out: string[] = [];
  const view = pack.semantic.find((v) => v.name === q?.view);
  for (const s of cov.slices.filter((x) => !q?.dimensions?.includes(x)).slice(0, 2)) out.push(`${kpi.name} by ${(view?.dimensions.find((d) => d.name === s)?.label ?? s).toLowerCase()}`);
  if (cov.grains.length && !q?.timeGrain) out.push(`${kpi.name} trend by ${cov.grains[0]}`);
  return out.slice(0, agent.guardrails.max_followups);
}

/** Answers a question as one agent in scripted mode. */
export async function respondScripted(agentId: string, question: string, deps: RespondDeps): Promise<AgentAnswer> {
  const { pack, rubrics } = deps;
  const started = performance.now();
  const clock = new Clock();
  const agent = pack.agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Unknown agent ${agentId}`);
  const trace: TraceStep[] = [];
  const finish = (a: AgentAnswer): AgentAnswer => ({ ...a, latencyMs: Math.round(performance.now() - started) });

  // 1 · Understand — guardrails first, then terms the question uses.
  const guard = checkGuardrails(agent, question, rubrics.matcher.entity_nouns);
  const terms = pack.glossary.filter((t) => [t.name, ...t.synonyms].some((p) => mentions(question, p))).map((t) => t.id);
  trace.push(step('understand', 'Understand', 'glossary', clock.lap(), terms.length ? `Resolved ${terms.length} glossary term(s)` : 'No glossary terms matched', terms, guard ? 'blocked' : 'ok'));
  const matcher = deps.matcher ?? matcherFor(pack);
  const ranked = matcher.rank(question);
  const mine = ranked.find((r) => r.scenario.agent === agentId);
  const other = ranked.find((r) => r.scenario.agent !== agentId);
  const { run_threshold: RUN, clarify_threshold: CLARIFY, redirect_margin: MARGIN } = rubrics.matcher;

  // A question that names a different covered KPI than the matched scenario is planned, not matched.
  const namedKpi = detectKpi(pack, agent, question);
  // A metric the question names that this agent does not cover must not ride generic wording
  // ("trended month by month") onto one of this agent's scenarios.
  const covered = new Set(agent.kpi_coverage.map((c) => pack.kpis.find((k) => k.id === c.kpi)?.metric));
  const foreign = pack.semantic.flatMap((v) => v.metrics.map((m) => m.name)).filter((m) => !covered.has(m) && metricMentioned(pack, m, question));
  const scenarioFits = (q: MetricQuery | null) =>
    !q || ((!namedKpi || q.metrics.includes(namedKpi.metric) || q.metrics.some((m) => metricMentioned(pack, m, question))) && (namedKpi || !foreign.length || q.metrics.some((m) => foreign.includes(m))));
  // A verified query wins over a curated scenario only when it matches the question more closely.
  const candidate = mine && mine.score >= RUN && scenarioFits(mine.scenario.query) ? mine : undefined;
  const vqMatch = verifiedMatcherFor(pack).best(agent, question, RUN);
  // A near match must also name one of its metrics — shared wording alone ("by region this year") is not enough.
  const vqNamed = (m: typeof vqMatch) => Boolean(m && (m.score === 1 || (scenarioFits(m.vq.query) && m.vq.query.metrics.some((x) => x === namedKpi?.metric || metricMentioned(pack, x, question)))));
  const verified = vqMatch && vqNamed(vqMatch) && (!candidate || vqMatch.score > candidate.score) ? vqMatch : null;
  const curated = verified ? undefined : candidate?.scenario;

  // A curated decline keeps its own wording; only a partial out-of-scope hit yields to other curated
  // scenarios — injection, record-level and full out-of-scope hits win over a matched non-decline scenario.
  const partialOos = guard?.kind === 'out_of_scope' && !guard.full;
  if (guard && !(curated && (partialOos || curated.kind === 'decline')) && !(verified?.score === 1 && partialOos)) {
    if (guard.kind === 'out_of_scope' && other && other.score >= RUN) {
      const to = pack.agents.find((a) => a.id === other.scenario.agent);
      if (to) return finish(textAnswer(agent, question, 'redirect', `${to.name} is the right agent for this.`, `${guard.reason} ${to.name} covers it: ${to.capability}`, trace, { redirectTo: { agentId: to.id, name: to.name } }));
    }
    return finish(textAnswer(agent, question, 'decline', 'I can’t help with that request.', guard.reason, trace, { followups: agent.scenarios.slice(0, 2).map((s) => pack.scenarios.find((x) => x.id === s)?.question ?? '').filter(Boolean) }));
  }

  // An agent that covers the KPI the other agent's scenario is about answers it itself (no redirect).
  const plannedHere = !curated && !verified && other ? plan(pack, agent, question) : null;
  const coversIt = Boolean(verified ?? plannedHere);
  if (!curated && !coversIt && other && other.score >= RUN && other.score >= (mine?.score ?? 0) + MARGIN) {
    const to = pack.agents.find((a) => a.id === other.scenario.agent);
    if (to) return finish(textAnswer(agent, question, 'redirect', `${to.name} is the right agent for this.`, `${to.name} covers it: ${to.capability}`, trace, { redirectTo: { agentId: to.id, name: to.name }, suggestions: [other.scenario.question] }));
  }

  // Scenario path.
  if (curated) {
    const s = curated;
    if (s.kind !== 'answer' || !s.query) {
      const kpis = agent.kpi_coverage.map((c) => pack.kpis.find((k) => k.id === c.kpi)?.name ?? c.kpi);
      const redirect = s.redirect_to ? pack.agents.find((a) => a.id === s.redirect_to) : undefined;
      return finish(
        textAnswer(agent, question, s.kind, s.answer.headline, s.answer.narrative, trace, {
          scenarioId: s.id,
          followups: s.followups,
          ...(s.kind === 'help' ? { suggestions: kpis } : {}),
          ...(s.kind === 'clarify' ? { suggestions: s.followups } : {}),
          ...(redirect ? { redirectTo: { agentId: redirect.id, name: redirect.name } } : {}),
        }),
      );
    }
    return finish(await execute(deps, agent, question, s.query, s.answer.headline, s.answer.narrative, s.answer.chart, trace, clock, s.id, s.followups));
  }

  if (verified) {
    const d = describeQuery(pack, verified.view, verified.kpi, verified.vq.query);
    trace.push(step('context', 'Verified query', 'context', clock.lap(), `Matched ${verified.vq.id} (${verified.score.toFixed(2)}): ${verified.vq.question}`, [verified.vq.id]));
    return finish(await execute(deps, agent, question, verified.vq.query, d.headline, d.narrative, d.chart, trace, clock, undefined, coverageFollowups(pack, agent, verified.vq.query)));
  }

  const p = plan(pack, agent, question);
  if (p) return finish(await execute(deps, agent, question, p.query, p.headline, p.narrative, p.chart, trace, clock, undefined, coverageFollowups(pack, agent, p.query)));

  if (mine && mine.score >= CLARIFY) {
    const options = ranked.filter((r) => r.scenario.agent === agentId).slice(0, 3).map((r) => r.scenario.question);
    return finish(textAnswer(agent, question, 'clarify', 'Did you mean one of these?', 'I can answer a few close variations of that question.', trace, { suggestions: options, followups: options }));
  }
  const kpis = agent.kpi_coverage.map((c) => pack.kpis.find((k) => k.id === c.kpi)?.name ?? c.kpi);
  return finish(
    textAnswer(agent, question, 'help', `I couldn’t match that to a governed KPI. ${agent.name} can answer about: ${kpis.slice(0, 6).join(', ')}.`, agent.capability, trace, {
      suggestions: kpis,
      followups: agent.scenarios.slice(0, 3).map((id) => pack.scenarios.find((x) => x.id === id)?.question ?? '').filter(Boolean),
    }),
  );
}

async function execute(
  deps: RespondDeps,
  agent: AgentManifest,
  question: string,
  query: MetricQuery,
  headlineTpl: string,
  narrativeTpl: string,
  chartType: AgentAnswer['chart']['type'],
  trace: TraceStep[],
  clock: Clock,
  scenarioId: string | undefined,
  followups: string[],
): Promise<AgentAnswer> {
  const { pack, qs, who } = deps;
  const view = pack.semantic.find((v) => v.name === query.view);
  const rules = view?.metrics.filter((m) => query.metrics.includes(m.name)).flatMap((m) => m.default_filters.map((f) => f.rule)) ?? [];
  trace.push(step('context', 'Apply context', 'context', clock.lap(), rules.length ? `Business rules in scope: ${rules.join(', ')}` : 'No business rules apply', rules));
  trace.push(step('model', 'Choose model', 'semantic', clock.lap(), `${query.view} · ${query.metrics.join(', ')}${query.dimensions?.length ? ` by ${query.dimensions.join(', ')}` : ''}`, [query.view, ...query.metrics]));

  let r: GovernedResult;
  try {
    r = await qs.run({ kind: 'metric', query, purpose: 'agent', question }, who);
  } catch (e) {
    if (e instanceof PolicyDenied) {
      trace.push(step('access', 'Check access', 'governance', clock.lap(), e.message, e.productId ? [e.productId] : [], 'blocked'));
      const product = pack.products.find((p) => p.id === e.productId);
      return textAnswer(agent, question, 'decline', `You don’t have access to ${product?.name ?? 'the data needed'} yet.`, `${e.message} ${product ? `Its steward can approve a request.` : ''}`.trim(), trace, {
        scenarioId,
        metricQuery: query,
        requestProductId: e.requestable ? (e.productId ?? undefined) : undefined,
        banners: [{ kind: 'no_access', text: e.message, productId: e.productId ?? undefined }],
      });
    }
    if (e instanceof IncidentBlocked) {
      trace.push(step('query', 'Query', 'gold', clock.lap(), e.message, [e.incidentId], 'blocked'));
      const t = pack.incidents.find((x) => x.id === e.incidentId);
      return {
        ...textAnswer(agent, question, 'decline', `I can’t answer that reliably right now — ${t?.title ?? 'an open incident'} affects the data.`, `${e.message} ${t?.resolution ?? ''}`.trim(), trace, {
          scenarioId,
          metricQuery: query,
          banners: [{ kind: 'incident', text: `${e.incidentId} (${t?.severity ?? ''}) — ${t?.title ?? ''}`, productId: e.productIds[0] }],
        }),
        confidence: 'unsafe',
      };
    }
    if (e instanceof CompileError) {
      trace.push(step('model', 'Choose model', 'semantic', clock.lap(), e.message, [], 'blocked'));
      return textAnswer(agent, question, 'help', 'I couldn’t build a governed query for that.', `${e.message}${e.suggestions.length ? ` Did you mean ${e.suggestions.join(', ')}?` : ''}`, trace, { scenarioId });
    }
    throw e;
  }
  const policyRefs = r.policiesApplied.filter((p) => p.kind !== 'limit').map((p) => p.ruleOrPolicyId ?? p.kind);
  trace.push(step('access', 'Check access', 'governance', clock.lap(), r.policiesApplied.filter((p) => p.kind !== 'limit' && p.kind !== 'rule').map((p) => p.detail).join('; ') || 'Entitled', [...new Set(policyRefs)]));
  trace.push(step('query', 'Query', 'gold', r.elapsedMs, `${r.rowCount} row(s) in ${r.elapsedMs} ms`, [r.queryLogId]));

  // Totals for `{{total.*}}` when the main query is sliced: same filters, no dimensions.
  const wantsTotal = /\{\{\s*total\./.test(`${headlineTpl} ${narrativeTpl}`);
  const totals: Record<string, number | null> = {};
  if (wantsTotal && (query.dimensions?.length || query.timeGrain)) {
    const t = await qs.run({ kind: 'metric', query: { view: query.view, metrics: query.metrics, timeRange: query.timeRange, filters: query.filters }, purpose: 'agent', question }, who);
    query.metrics.forEach((m, i) => (totals[m] = (t.rows[0]?.[i] as number | null) ?? null));
  }

  // 6 · Ground — cite the best passage from the agent's corpora.
  const corpora = agent.tools.flatMap((t) => (t.tool === 'search_context' ? t.corpora : []));
  const hit = corpora.length ? searchDocuments(pack, question, 1, corpora)[0] : undefined;
  trace.push(step('ground', 'Ground', 'context', clock.lap(), hit ? `${hit.title} §${hit.chunk}` : 'No supporting document passage', hit ? [`${hit.docId}#${hit.chunk}`] : [], hit ? 'ok' : 'skipped'));

  const data = { columns: r.columns.map((c) => c.name), rows: r.rows, fields: r.fields, totals, kpiFor: (m: string) => pack.kpis.find((k) => k.metric === m), locale: pack.manifest.locale, currency: pack.manifest.currency };
  let headline = renderTemplate(headlineTpl, data);
  let narrative = renderTemplate(narrativeTpl, data);
  const rowFilter = r.policiesApplied.find((p) => p.kind === 'row_access');
  if (r.rowCount === 0) {
    headline = 'No data matched that question for your access.';
    narrative = 'The governed query returned no rows.';
  }
  if (rowFilter) narrative = `${narrative} Filtered to ${rowFilter.detail} by ${rowFilter.ruleOrPolicyId}.`;

  const citations: Citation[] = [
    ...r.sources.map((s) => ({ kind: 'product' as const, ref: `${s.productId}@${s.version}`, label: `${pack.products.find((p) => p.id === s.productId)?.name ?? s.productId} ${s.version}`, detail: s.certified ? 'Certified' : 'Not certified' })),
    ...query.metrics.map((m) => ({ kind: 'metric' as const, ref: `${query.view}.${m}`, label: view?.metrics.find((x) => x.name === m)?.label ?? m, detail: view?.metrics.find((x) => x.name === m)?.term })),
    ...r.ruleRefs.map((id) => ({ kind: 'rule' as const, ref: id, label: id, detail: pack.rules.find((x) => x.id === id)?.text })),
    ...pack.verifiedQueries
      .filter((v) => v.status === 'active' && v.query === query)
      .concat(pack.verifiedQueries.filter((v) => v.status === 'active' && v.query !== query && v.query.view === query.view && v.query.metrics.join() === query.metrics.join() && (v.query.dimensions ?? []).join() === (query.dimensions ?? []).join()))
      .slice(0, 1)
      .map((v) => ({ kind: 'verified_query' as const, ref: v.id, label: v.id, detail: v.question })),
    { kind: 'sql' as const, ref: r.queryLogId, label: 'Governed query', detail: r.displaySql },
    ...(hit ? [{ kind: 'document' as const, ref: `${hit.docId}#${hit.chunk}`, label: hit.title, detail: hit.text.slice(0, 240) }] : []),
  ];

  const banners: Banner[] = [];
  for (const s of r.sources.filter((x) => !x.certified)) banners.push({ kind: 'not_certified', text: `${pack.products.find((p) => p.id === s.productId)?.name ?? s.productId} is not certified yet — treat this number as provisional.`, productId: s.productId });
  if (r.maskedColumns.length) banners.push({ kind: 'masked', text: `Some values are masked for you (${r.maskedColumns.join(', ')}).` });
  if (rowFilter) banners.push({ kind: 'row_filtered', text: `Showing ${rowFilter.detail} only (${rowFilter.ruleOrPolicyId}).` });
  for (const inc of new Map(r.policiesApplied.filter((p) => p.kind === 'incident').map((p) => [p.ruleOrPolicyId, p])).values()) banners.push({ kind: 'incident', text: inc.detail, productId: r.sources.find((s) => s.health !== 'healthy')?.productId });
  const confidence: Confidence = r.sources.some((s) => !s.certified || s.health !== 'healthy') || banners.some((b) => b.kind === 'incident') ? 'questionable' : 'trusted';
  const numericClaims = (headline.match(/\d/g) ?? []).length > 0;
  trace.push(step('answer', 'Answer', 'agent', clock.lap(), numericClaims ? `${citations.length} citations; every number comes from ${r.queryLogId}` : 'Answer has no numeric claims', citations.map((c) => c.ref)));

  const metric = view?.metrics.find((m) => m.name === query.metrics[0]);
  const x = query.timeGrain ? 'period' : query.dimensions?.[0];
  return {
    kind: 'answer',
    agentId: agent.id,
    question,
    mode: 'scripted',
    headline,
    narrative,
    chart: { type: r.rowCount > 1 ? (chartType === 'kpi' ? 'bar' : chartType) : 'kpi', x, y: metric?.name },
    result: { columns: r.columns, rows: r.rows, totals, fields: r.fields, maskedColumns: r.maskedColumns, rowFiltered: r.rowFiltered, displaySql: r.displaySql, policiesApplied: r.policiesApplied, sources: r.sources, queryLogId: r.queryLogId, elapsedMs: r.elapsedMs },
    citations,
    confidence,
    banners,
    followups: followups.slice(0, agent.guardrails.max_followups),
    trace,
    scenarioId,
    metricQuery: query,
    rules: r.ruleRefs,
    latencyMs: 0,
  };
}
