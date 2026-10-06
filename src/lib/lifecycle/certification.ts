/**
 * Certification checks (06 §3): eight automated inputs to gate 11, evaluated for real from pack content
 * plus live state (applied fixes, verified-query overlays, quality snapshot, gate states). The cert demo
 * product's warn/fail come from genuine state (pending verified queries, masking not yet attached), and
 * its scripted fixes change that state.
 */
import { lineageAround } from '@/lib/packs/lineage';
import type { DataProduct, Pack, Rubrics } from '@/lib/packs/schema';
import { productObjects, productRules } from './quality';

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  id: string;
  n: number;
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: { id: string; label: string; applied: boolean };
}

export interface CertificationFacts {
  appliedFixes: string[];
  qualityScore: number | null;
  approvedGates: number[];
  /** Columns in the contract artifact that are missing from the warehouse. */
  contractColumnsMissing: string[];
  /** Share of the product's verified queries that execute (0–1). */
  vqExecRate: number;
  /** Bound-agent scripted eval pass rate (0–1), when known. */
  agentEvalRate?: number;
}

export const CHECKS = [
  { id: 'ownership', label: 'Ownership & purpose' },
  { id: 'contract', label: 'Data contract' },
  { id: 'quality', label: 'Data quality' },
  { id: 'semantic.verified_queries', label: 'Semantic model' },
  { id: 'glossary', label: 'Glossary alignment' },
  { id: 'governance.masking', label: 'Governance' },
  { id: 'lineage', label: 'Lineage & observability' },
  { id: 'agent_readiness', label: 'Agent readiness' },
] as const;

/** Verified queries in force: pack `active` ones plus those activated by an applied fix overlay. */
export function activeVerifiedQueries(pack: Pack, appliedFixes: string[]): Pack['verifiedQueries'] {
  const activated = new Set(
    pack.products.flatMap((p) => p.certification_script?.fixes.filter((f) => appliedFixes.includes(f.id)).flatMap((f) => ('overlay' in f.effect ? f.effect.keys : [])) ?? []),
  );
  return pack.verifiedQueries.filter((q) => q.status === 'active' || activated.has(q.id));
}

/** Columns a product exposes: those its semantic view's dimensions and metrics read (all upstream columns when it has no view). */
export function exposedColumns(pack: Pack, product: DataProduct): Set<string> | null {
  const view = pack.semantic.find((v) => v.name === product.semantic_view);
  if (!view) return null;
  const out = new Set<string>();
  const exprs = [...view.dimensions.map((d) => d.expr), ...view.metrics.map((m) => m.expr), ...view.time_dimensions.map((t) => t.expr)];
  for (const e of exprs) {
    for (const m of e.matchAll(/\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g)) {
      const table = view.tables.find((t) => t.alias === m[1]);
      if (table) out.add(`${table.fqn}.${m[2]}`);
    }
  }
  return out;
}

export function evaluateCertification(pack: Pack, rubrics: Rubrics, product: DataProduct, facts: CertificationFacts): CheckResult[] {
  const c = rubrics.certification;
  const objects = productObjects(pack, product);
  const tags = pack.policies.column_tags.filter((t) => objects.includes(t.column.split('.').slice(0, 2).join('.')));
  const view = pack.semantic.find((v) => v.name === product.semantic_view);
  const fixFor = (check: string) => {
    const f = product.certification_script?.fixes.find((x) => x.check === check);
    return f ? { id: f.id, label: f.label, applied: facts.appliedFixes.includes(f.id) } : undefined;
  };
  const out: CheckResult[] = [];
  const add = (n: number, status: CheckStatus, detail: string) => {
    const def = CHECKS[n - 1];
    if (!def) return;
    const fix = fixFor(def.id);
    out.push({ id: def.id, n, label: def.label, status, detail, ...(fix ? { fix } : {}) });
  };

  const own = [product.owner, product.steward, product.purpose, product.decision.decision].every(Boolean);
  add(1, own ? 'pass' : 'fail', own ? 'Owner, steward, purpose and decision recorded.' : 'Assign a steward and record the purpose and decision.');

  const contractOk = facts.approvedGates.includes(5) && product.sla.freshness_minutes > 0 && facts.contractColumnsMissing.length === 0;
  add(2, contractOk ? 'pass' : 'fail', contractOk ? 'Contract approved at gate 5; SLA set; schema matches the warehouse.' : facts.contractColumnsMissing.length ? `Contract columns missing from the warehouse: ${facts.contractColumnsMissing.join(', ')}` : 'The data contract (gate 5) is not approved.');

  const q = facts.qualityScore;
  add(3, q === null ? 'fail' : q >= c.dq_pass ? 'pass' : q >= c.dq_warn ? 'warn' : 'fail', q === null ? 'No DQ run yet.' : `Quality score ${q} (pass ≥ ${c.dq_pass}, warn ≥ ${c.dq_warn}).`);

  const vqs = view ? activeVerifiedQueries(pack, facts.appliedFixes).filter((x) => x.query.view === view.name).length : 0;
  const evalPct = Math.round(facts.vqExecRate * 100);
  const semStatus: CheckStatus = !view ? 'fail' : vqs >= c.min_verified_queries && facts.vqExecRate >= c.semantic_eval_min ? 'pass' : 'warn';
  add(4, semStatus, view ? `${vqs} verified queries (need ≥ ${c.min_verified_queries}); ${evalPct}% execute and match.` : 'No semantic view.');

  const metricsWithoutTerm = view?.metrics.filter((m) => !m.term).map((m) => m.name) ?? [];
  const cdeWithoutTerm = tags.filter((t) => t.cde && !pack.glossary.some((g) => g.mappings.columns.includes(t.column))).map((t) => t.column);
  add(5, metricsWithoutTerm.length + cdeWithoutTerm.length === 0 ? 'pass' : 'warn', metricsWithoutTerm.length + cdeWithoutTerm.length === 0 ? 'Every metric and critical data element maps to a glossary term.' : `Unmapped: ${[...metricsWithoutTerm, ...cdeWithoutTerm].join(', ')}`);

  const exposed = exposedColumns(pack, product);
  const unmasked = tags.filter((t) => t.classes.length && (!exposed || exposed.has(t.column)) && (!t.masking || (t.mask_pending_fix && !facts.appliedFixes.includes(t.mask_pending_fix)))).map((t) => t.column);
  const rowPolicy = pack.policies.row_access_policies.some((r) => r.bindings.some((b) => objects.includes(b.object)));
  const needsRow = objects.some((o) => pack.policies.row_access_policies.some((r) => r.bindings.some((b) => b.object === o)));
  const grants = pack.policies.grants.some((g) => g.products.includes(product.id));
  const govOk = unmasked.length === 0 && (!needsRow || rowPolicy) && grants;
  add(6, govOk ? 'pass' : 'fail', govOk ? 'Sensitive columns tagged and masked; row access and grants defined.' : unmasked.length ? `Sensitive columns without masking: ${unmasked.join(', ')}` : 'Grants or row access policy missing.');

  const lineageOk = lineageAround(pack, product.id).nodes.some((n) => n.layer === 'bronze');
  const freshness = productRules(pack, product).some((r) => r.dimension === 'timeliness');
  add(7, lineageOk && freshness ? 'pass' : 'warn', `Lineage to Bronze ${lineageOk ? 'complete' : 'incomplete'}; freshness monitor ${freshness ? 'active' : 'missing'}.`);

  const agents = pack.agents.filter((a) => a.products.some((b) => b.id === product.id));
  const instrOk = agents.every((a) => a.instructions.every((id) => pack.instructions.some((i) => i.id === id)));
  const evalOk = (facts.agentEvalRate ?? 1) >= c.agent_eval_min;
  const groundingOk = facts.approvedGates.includes(10);
  const agentStatus: CheckStatus = agents.length === 0 ? 'warn' : groundingOk && instrOk && evalOk ? 'pass' : 'fail';
  add(8, agentStatus, agents.length === 0 ? 'No agent is bound to this product yet.' : `Grounding pack ${groundingOk ? 'approved' : 'not approved'}; instructions ${instrOk ? 'present' : 'missing'}; bound-agent eval ${Math.round((facts.agentEvalRate ?? 1) * 100)}%.`);
  return out;
}

export const allPass = (checks: CheckResult[]) => checks.every((c) => c.status === 'pass');
