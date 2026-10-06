/**
 * Agent Factory (01 §M7, 08 §6, 08 §8): Agent Designer (heuristic drafts of coverage, instructions and
 * out-of-scope), factory manifests merged into the pack the engines see, and the 8-check publish gate.
 */
import { AgentManifest, type Instruction, type Pack } from '@/lib/packs/schema';
import type { EvalReport } from './eval';

export const INSTRUCTION_KINDS = ['persona', 'response', 'guardrail', 'orchestration'] as const;
export type InstructionKind = (typeof INSTRUCTION_KINDS)[number];

/** A factory agent as stored: the manifest plus its four instruction texts. */
export interface FactoryAgent {
  manifest: AgentManifest;
  instructions: Record<InstructionKind, string>;
}

/** Coverage proposed from the chosen products' semantic views: every KPI on those views, its view's grains and slices. */
export function proposeCoverage(pack: Pack, productIds: string[], kpiIds?: string[]): AgentManifest['kpi_coverage'] {
  const views = pack.products.filter((p) => productIds.includes(p.id)).flatMap((p) => (p.semantic_view ? [p.semantic_view] : []));
  return pack.kpis
    .filter((k) => (!kpiIds || kpiIds.includes(k.id)) && pack.semantic.some((v) => views.includes(v.name) && v.metrics.some((m) => m.name === k.metric)))
    .map((k) => {
      const v = pack.semantic.find((x) => x.metrics.some((m) => m.name === k.metric));
      const sensitive = new Set(pack.policies.column_tags.filter((t) => t.classes.length).map((t) => t.column.split('.')[2]));
      return {
        kpi: k.id,
        grains: v?.time_dimensions.length ? (['month', 'quarter', 'year'] as const).slice() : [],
        slices: (v?.dimensions ?? []).filter((d) => !sensitive.has(d.expr.split('.')[1] ?? '')).map((d) => d.name).slice(0, 4),
        depth: 'explain' as const,
      };
    });
}

/** Agent Designer, heuristic provider: drafts the four instructions and an out-of-scope list (humans edit). */
export function designInstructions(pack: Pack, input: { name: string; personaServed: string; decisions: string[]; productIds: string[]; kpiIds: string[] }): { instructions: Record<InstructionKind, string>; outOfScope: string[] } {
  const products = pack.products.filter((p) => input.productIds.includes(p.id));
  const kpis = pack.kpis.filter((k) => input.kpiIds.includes(k.id)).map((k) => k.name);
  return {
    instructions: {
      persona: `You are ${input.name}, serving ${input.personaServed} at ${pack.manifest.company.name}. You help with: ${input.decisions.join('; ') || 'the decisions your products support'}. You speak plainly and lead with the number.`,
      response: `Answer in one headline sentence with the key figure, then at most three sentences of context. Cite the governed product and metric for every number. KPIs you cover: ${kpis.join(', ')}.`,
      guardrail: `Use only ${products.map((p) => p.name).join(', ')}. Never reveal masked values or individual records; answer at an aggregate level. Decline anything outside your KPIs and name the agent that covers it.`,
      orchestration: 'Look up the metric definition when a term is ambiguous, run one governed query per question, and search policy documents only to explain a rule. Finish with a cited answer.',
    },
    outOfScope: ['Records about individual people', 'Operational write-back or approvals', 'Forecasts beyond the governed data', ...pack.agents.slice(0, 2).map((a) => a.domain)],
  };
}

/** Merges factory agents (and their instructions) into the pack the engines see. Pack agents win on id clashes. */
export function withFactoryAgents(pack: Pack, agents: FactoryAgent[]): Pack {
  if (!agents.length) return pack;
  const extra = agents.filter((a) => !pack.agents.some((p) => p.id === a.manifest.id));
  const instructions: Instruction[] = extra.flatMap((a) => INSTRUCTION_KINDS.map((kind, i) => ({ id: a.manifest.instructions[i] ?? `${a.manifest.id}-${kind}`, agent: a.manifest.id, kind, version: 1, text: a.instructions[kind] })));
  return { ...pack, agents: [...pack.agents, ...extra.map((a) => a.manifest)], instructions: [...pack.instructions, ...instructions] };
}

export interface GateCheck {
  n: number;
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  fix: string;
}

/** Publish gate (08 §6): eight blocking checks. */
export function publishGate(pack: Pack, agent: FactoryAgent, ctx: { productStatus: Record<string, string>; eval: EvalReport | null; humanApproval: boolean }): GateCheck[] {
  const m = agent.manifest;
  const parsed = AgentManifest.safeParse(m);
  const views = pack.products.filter((p) => m.products.some((b) => b.id === p.id)).flatMap((p) => (p.semantic_view ? [p.semantic_view] : []));
  const uncertified = m.products.filter((b) => (ctx.productStatus[b.id] ?? pack.products.find((p) => p.id === b.id)?.initial_status) !== 'CERTIFIED').map((b) => b.id);
  const outside = m.kpi_coverage.filter((c) => {
    const k = pack.kpis.find((x) => x.id === c.kpi);
    const v = pack.semantic.find((x) => views.includes(x.name) && x.metrics.some((mm) => mm.name === k?.metric));
    return !v || c.slices.some((s) => !v.dimensions.some((d) => d.name === s));
  });
  const instr = INSTRUCTION_KINDS.every((k) => (agent.instructions[k] ?? '').trim().length >= 20);
  const checks: Omit<GateCheck, 'n'>[] = [
    { id: 'manifest', label: 'Manifest valid', passed: parsed.success, detail: parsed.success ? 'Schema valid' : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), fix: 'Complete the required fields' },
    { id: 'certified', label: 'Every bound product is Certified', passed: m.products.length > 0 && uncertified.length === 0, detail: uncertified.length ? `Not certified: ${uncertified.join(', ')}` : `${m.products.length} certified product(s)`, fix: 'Remove the product or certify it in Product Studio' },
    { id: 'coverage', label: 'Coverage within bound semantics', passed: m.kpi_coverage.length > 0 && outside.length === 0, detail: outside.length ? `Outside bound views: ${outside.map((c) => c.kpi).join(', ')}` : `${m.kpi_coverage.length} KPI(s) covered`, fix: 'Drop KPIs/slices the bound products do not expose' },
    { id: 'instructions', label: 'Four instructions present and versioned', passed: instr && m.instructions.length === 4, detail: instr ? 'persona, response, guardrail, orchestration' : 'An instruction is missing or too short', fix: 'Draft with the Agent Designer, then edit' },
    { id: 'guardrails', label: 'Guardrails present', passed: m.guardrails.citations_required && m.out_of_scope.length >= 3, detail: `citations ${m.guardrails.citations_required ? 'required' : 'optional'}; ${m.out_of_scope.length} out-of-scope topic(s)`, fix: 'Require citations and list ≥ 3 out-of-scope topics' },
    { id: 'budgets', label: 'Budgets set', passed: m.budgets.cost_per_answer_usd > 0 && m.budgets.p95_latency_ms > 0 && m.budgets.max_tool_rounds > 0, detail: `$${m.budgets.cost_per_answer_usd}/answer, p95 ${m.budgets.p95_latency_ms} ms, ${m.budgets.max_tool_rounds} rounds`, fix: 'Set cost, latency and tool-round budgets' },
    { id: 'eval', label: 'Latest evaluation meets every threshold', passed: Boolean(ctx.eval?.passed), detail: ctx.eval ? Object.entries(ctx.eval.suites).filter(([, v]) => v.n).map(([k, v]) => `${k} ${v.score === null ? '—' : Math.round(v.score * 100)}% (≥ ${Math.round(v.threshold * 100)}%)`).join(', ') : 'Not evaluated yet', fix: 'Run the evaluation; fix failing cases' },
    { id: 'approval', label: 'Owner, on-call and human approval recorded', passed: Boolean(m.owner && m.on_call) && ctx.humanApproval, detail: `${m.owner ? 'owner' : 'no owner'} · ${m.on_call ? 'on-call' : 'no on-call'} · ${ctx.humanApproval ? 'approved by a human' : 'awaiting human approval'}`, fix: 'Approve as a product owner or steward' },
  ];
  return checks.map((c, i) => ({ ...c, n: i + 1 }));
}
