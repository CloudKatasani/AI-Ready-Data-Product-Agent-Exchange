/**
 * Live engine (08 §4): Messages API with tools; the model must finish with submit_answer, which is
 * checked by the grounding validator (one repair turn, then failure). Any failure throws LiveFailure so
 * the runtime can fall back to the scripted engine visibly — never an error screen.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { AgentManifest, Pack, Rubrics } from '@/lib/packs/schema';
import { systemPrincipal } from '@/lib/query/principal';
import type { QueryService } from '@/lib/query/query-service';
import type { GovernedResult, Principal } from '@/lib/query/types';
import { type GroundingContext, validateGrounding } from '../grounding';
import type { AgentAnswer, Banner, Citation, Confidence, TraceStep } from '../types';
import type { LlmClient } from './client';
import { systemPrompt } from './prompt';
import { runTool, type SubmitAnswer, SubmitAnswerArgs, type ToolState, toolDefinitions } from './tools';

export type LiveFailureReason = 'no_key' | 'no_model' | 'network' | 'timeout' | 'budget' | 'grounding' | 'rounds' | 'refusal' | 'invalid';

export class LiveFailure extends Error {
  constructor(
    readonly reason: LiveFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'LiveFailure';
  }
}

export interface LiveDeps {
  pack: Pack;
  rubrics: Rubrics;
  qs: QueryService;
  who: Principal;
  client: LlmClient;
  model: string;
  timeoutMs: number;
  maxRounds: number;
  /** Remaining session budget in USD (08 §4.5). */
  budgetUsd?: number;
}

const numericCells = (r: GovernedResult) => r.rows.flat().filter((v): v is number => typeof v === 'number');

const maskedCache = new Map<string, string[]>();

/** Sensitive sample values (system principal) the persona may not see — the leakage check's reference set. */
async function maskedValues(pack: Pack, qs: QueryService, who: Principal): Promise<string[]> {
  const key = `${pack.manifest.id}|${who.unmasked.join(',')}`;
  const hit = maskedCache.get(key);
  if (hit) return hit;
  const out = new Set<string>();
  const byObject = new Map<string, string[]>();
  for (const t of pack.policies.column_tags.filter((x) => x.classes.some((c) => !who.unmasked.includes(c)))) {
    const [schema, obj, col] = t.column.split('.');
    byObject.set(`${schema}.${obj}`, [...(byObject.get(`${schema}.${obj}`) ?? []), col ?? '']);
  }
  for (const [fqn, cols] of byObject) {
    try {
      const r = await qs.run({ kind: 'preview', fqn, limit: 20 }, systemPrincipal(pack));
      for (const c of cols) {
        const i = r.columns.findIndex((x) => x.name === c);
        for (const row of r.rows) if (i >= 0 && typeof row[i] === 'string') out.add(String(row[i]));
      }
    } catch {
      // object not previewable — no reference values
    }
  }
  const list = [...out];
  maskedCache.set(key, list);
  return list;
}

function price(rubrics: Rubrics, usage: { in: number; out: number }): number {
  const p = rubrics.llm.pricing_illustrative_per_mtok.answer ?? { in: 0, out: 0 };
  return Math.round(((usage.in * p.in + usage.out * p.out) / 1e6) * 10000) / 10000;
}

export async function respondLive(agent: AgentManifest, question: string, deps: LiveDeps): Promise<AgentAnswer> {
  const { pack, rubrics, qs, who, client } = deps;
  if (!deps.model) throw new LiveFailure('no_model', 'No answer model is configured (KEYSTONE_MODEL_ANSWER).');
  const started = performance.now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), deps.timeoutMs);
  const state: ToolState = { results: new Map(), docs: new Map(), denied: [] };
  const toolCalls: NonNullable<AgentAnswer['toolCalls']> = [];
  const usage = { in: 0, out: 0 };
  const tools = toolDefinitions(agent);
  const cached = tools.map((t, i) => (i === tools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t));
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: systemPrompt(pack, agent, who), cache_control: { type: 'ephemeral' } }];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }];
  let repairs = 0;
  let nudged = false;
  try {
    for (let round = 0; round < deps.maxRounds; round++) {
      let res: Anthropic.Message;
      try {
        res = await client.send({ model: deps.model, max_tokens: 4096, system, tools: cached, tool_choice: { type: 'auto' }, messages }, abort.signal);
      } catch (e) {
        if (abort.signal.aborted) throw new LiveFailure('timeout', `No answer within ${deps.timeoutMs} ms.`);
        throw new LiveFailure('network', (e as Error).message.slice(0, 200));
      }
      usage.in += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      usage.out += res.usage.output_tokens;
      if (deps.budgetUsd !== undefined && price(rubrics, usage) > deps.budgetUsd) throw new LiveFailure('budget', 'The session LLM budget is spent.');
      if (res.stop_reason === 'refusal') throw new LiveFailure('refusal', 'The model declined this request.');
      messages.push({ role: 'assistant', content: res.content });
      const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (!uses.length) {
        if (nudged) throw new LiveFailure('invalid', 'The model did not submit an answer.');
        nudged = true;
        messages.push({ role: 'user', content: 'Call submit_answer now with your final answer.' });
        continue;
      }
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of uses) {
        if (u.name !== 'submit_answer') {
          const r = await runTool({ pack, agent, qs, who, question, state }, u.name, u.input);
          toolCalls.push({ name: u.name, ok: r.ok, detail: r.detail });
          results.push({ type: 'tool_result', tool_use_id: u.id, content: r.content, ...(r.ok ? {} : { is_error: true }) });
          continue;
        }
        const parsed = SubmitAnswerArgs.safeParse(u.input);
        const verdict = parsed.success ? validateGrounding(parsed.data, await groundingContext(deps, state)) : { ok: false, violations: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), numbers: 0 };
        toolCalls.push({ name: 'submit_answer', ok: verdict.ok, detail: verdict.ok ? `grounded (${verdict.numbers} number(s))` : verdict.violations.join(' ') });
        if (verdict.ok && parsed.success) {
          return buildAnswer(agent, question, parsed.data, deps, state, toolCalls, usage, Math.round(performance.now() - started));
        }
        if (repairs >= 1) throw new LiveFailure('grounding', verdict.violations.join(' '));
        repairs += 1;
        results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: `Rejected by the grounding validator: ${verdict.violations.join(' ')} Fix these and call submit_answer again, using only numbers from cited result_ids.` });
      }
      messages.push({ role: 'user', content: results });
    }
    throw new LiveFailure('rounds', `No grounded answer within ${deps.maxRounds} tool rounds.`);
  } finally {
    clearTimeout(timer);
  }
}

async function groundingContext(deps: LiveDeps, state: ToolState): Promise<GroundingContext> {
  const { pack, qs, who } = deps;
  const products = new Set([...state.results.values()].flatMap((r) => r.sources.map((s) => s.productId)));
  return {
    results: new Map([...state.results.entries()].map(([id, r]) => [id, numericCells(r)])),
    docIds: new Set(state.docs.keys()),
    metrics: new Set(pack.semantic.flatMap((v) => v.metrics.flatMap((m) => [m.name, `${v.name}.${m.name}`]))),
    rules: new Set(pack.rules.map((r) => r.id)),
    maskedValues: await maskedValues(pack, qs, who),
    unentitledProducts: who.roles.some((r) => r === 'DATA_STEWARD' || r === 'PLATFORM_ADMIN') ? [] : [...products].filter((p) => !who.entitlements.includes(p)),
    tolerance: deps.rubrics.grounding.derived_value_tolerance_rel,
    labels: [
      ...[...state.results.values()].flatMap((r) => [...r.rows.flat().filter((v): v is string => typeof v === 'string'), ...r.fields.map((f) => f.label)]),
      ...pack.kpis.map((k) => k.name),
      ...pack.semantic.flatMap((v) => v.metrics.map((m) => m.label)),
    ],
  };
}

function buildAnswer(agent: AgentManifest, question: string, s: SubmitAnswer, deps: LiveDeps, state: ToolState, toolCalls: NonNullable<AgentAnswer['toolCalls']>, usage: { in: number; out: number }, latencyMs: number): AgentAnswer {
  const { pack, rubrics } = deps;
  const cited = [...new Set(s.citations.flatMap((c) => (c.result_id ? [c.result_id] : [])))];
  const mainId = s.chart?.result_id ?? s.table?.result_id ?? cited[0];
  const main = mainId ? state.results.get(mainId) : undefined;
  const used = cited.map((id) => state.results.get(id)).filter((r): r is GovernedResult => Boolean(r));
  const sources = [...new Map(used.flatMap((r) => r.sources).map((x) => [x.productId, x])).values()];
  const rules = [...new Set([...used.flatMap((r) => r.ruleRefs), ...s.citations.flatMap((c) => (c.rule_id ? [c.rule_id] : []))])];
  const citations: Citation[] = [
    ...sources.map((x) => ({ kind: 'product' as const, ref: `${x.productId}@${x.version}`, label: `${pack.products.find((p) => p.id === x.productId)?.name ?? x.productId} ${x.version}`, detail: x.certified ? 'Certified' : 'Not certified' })),
    ...[...new Set(s.citations.flatMap((c) => (c.metric ? [c.metric] : [])))].map((m) => ({ kind: 'metric' as const, ref: m, label: m })),
    ...rules.map((id) => ({ kind: 'rule' as const, ref: id, label: id, detail: pack.rules.find((r) => r.id === id)?.text })),
    ...used.map((r) => ({ kind: 'sql' as const, ref: r.queryLogId, label: 'Governed query', detail: r.displaySql })),
    ...[...new Set(s.citations.flatMap((c) => (c.doc_id ? [c.doc_id] : [])))].map((d) => ({ kind: 'document' as const, ref: d, label: state.docs.get(d) ?? d })),
  ];
  const banners: Banner[] = [];
  for (const x of sources.filter((y) => !y.certified)) banners.push({ kind: 'not_certified', text: `${pack.products.find((p) => p.id === x.productId)?.name ?? x.productId} is not certified yet — treat this number as provisional.`, productId: x.productId });
  const masked = [...new Set(used.flatMap((r) => r.maskedColumns))];
  if (masked.length) banners.push({ kind: 'masked', text: `Some values are masked for you (${masked.join(', ')}).` });
  const rf = used.flatMap((r) => r.policiesApplied).find((p) => p.kind === 'row_access');
  if (rf) banners.push({ kind: 'row_filtered', text: `Showing ${rf.detail} only (${rf.ruleOrPolicyId}).` });
  if (state.denied[0]) banners.push({ kind: 'no_access', text: state.denied[0].message, productId: state.denied[0].productId ?? undefined });
  const incidents = [...new Map(used.flatMap((r) => r.policiesApplied).filter((p) => p.kind === 'incident').map((p) => [p.ruleOrPolicyId, p])).values()];
  for (const inc of incidents) banners.push({ kind: 'incident', text: inc.detail, productId: sources.find((x) => x.health !== 'healthy')?.productId });
  const confidence: Confidence = sources.some((x) => !x.certified || x.health !== 'healthy') || incidents.length ? 'questionable' : 'trusted';
  const step = (id: TraceStep['id'], label: string, layer: string, detail: string, refs: string[] = [], status: TraceStep['status'] = 'ok'): TraceStep => ({ id, label, layer, status, ms: 0, refs, detail });
  const trace: TraceStep[] = [
    step('understand', 'Understand', 'glossary', `Live model read the question (${toolCalls.length} tool call(s))`),
    step('context', 'Apply context', 'context', rules.length ? `Business rules in force: ${rules.join(', ')}` : 'No business rules applied', rules),
    step('model', 'Choose model', 'semantic', toolCalls.filter((t) => t.name === 'semantic_query').map((t) => t.detail).join('; ') || 'No semantic query', cited),
    step('access', 'Check access', 'governance', used.flatMap((r) => r.policiesApplied).filter((p) => p.kind !== 'limit').map((p) => p.detail).join('; ') || (state.denied[0]?.message ?? 'Entitled'), [], state.denied.length ? 'blocked' : 'ok'),
    step('query', 'Query', 'gold', `${used.length} governed result(s) cited`, used.map((r) => r.queryLogId)),
    step('ground', 'Ground', 'context', state.docs.size ? `Documents: ${[...state.docs.values()].join(', ')}` : 'No documents retrieved', [...state.docs.keys()], state.docs.size ? 'ok' : 'skipped'),
    step('answer', 'Answer', 'agent', `Grounding validator passed; ${usage.in} in / ${usage.out} out tokens; illustrative cost $${price(rubrics, usage)}`, citations.map((c) => c.ref)),
  ];
  const redirect = s.redirect_agent_id ? pack.agents.find((a) => a.id === s.redirect_agent_id) : undefined;
  return {
    kind: s.kind,
    agentId: agent.id,
    question,
    mode: 'live',
    headline: s.headline,
    narrative: s.narrative,
    chart: { type: main && main.rowCount > 1 ? (s.chart?.type ?? 'table') : main ? 'kpi' : 'none', x: s.chart?.x, y: s.chart?.y },
    ...(main ? { result: { columns: main.columns, rows: main.rows, fields: main.fields, maskedColumns: main.maskedColumns, rowFiltered: main.rowFiltered, displaySql: main.displaySql, policiesApplied: main.policiesApplied, sources: main.sources, queryLogId: main.queryLogId, elapsedMs: main.elapsedMs } } : {}),
    citations,
    confidence,
    banners,
    followups: (s.followups ?? []).slice(0, agent.guardrails.max_followups),
    trace,
    rules,
    ...(redirect ? { redirectTo: { agentId: redirect.id, name: redirect.name } } : {}),
    ...(s.request_product_id || state.denied[0]?.productId ? { requestProductId: s.request_product_id ?? state.denied[0]?.productId ?? undefined } : {}),
    latencyMs,
    toolCalls,
    tokensIn: usage.in,
    tokensOut: usage.out,
    costUsd: price(rubrics, usage),
  };
}
