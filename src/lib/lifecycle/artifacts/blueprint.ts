/**
 * Blueprint generator: drafts every artifact for a pack product from pack content (decision, KPIs,
 * semantic view, policies, DQ rules, lineage, value case). The seed commits these as the product's
 * human-authored history; lifecycle agents use the same facts to propose values for new products.
 */
import { lineageAround } from '@/lib/packs/lineage';
import type { DataProduct, Pack } from '@/lib/packs/schema';
import { productObjects, productRules } from '../quality';
import type { ArtifactType } from '../stages';
import type { ArtifactContent } from './registry';

export interface BlueprintFacts {
  profile?: { object: string; rows: number; columns: number; worstNullPct: number; notes: string }[];
  qualityScore?: number;
  checks?: { check: string; status: string; detail: string }[];
  asOf?: string;
}

const personaName = (pack: Pack, id: string | null) => (id ? (pack.personas.find((p) => p.id === id)?.name ?? id) : '');

export function upstreamObjects(pack: Pack, product: DataProduct): { fqn: string; layer: string }[] {
  const g = lineageAround(pack, product.id);
  return g.nodes.filter((n) => n.kind === 'object').map((n) => ({ fqn: n.id, layer: n.layer })).sort((a, b) => a.fqn.localeCompare(b.fqn));
}

function erMermaid(pack: Pack, product: DataProduct): string {
  const view = pack.semantic.find((v) => v.name === product.semantic_view);
  if (!view) return `erDiagram\n  ${product.upstream.map((u) => u.split('.')[1]).join(' ||--o{ ')} : relates`;
  const lines = ['erDiagram'];
  const table = (alias: string) => view.tables.find((t) => t.alias === alias)?.fqn.split('.')[1] ?? alias;
  for (const r of view.relationships) {
    const [fromAlias = '', col = ''] = r.from.split('.');
    const [toAlias = ''] = r.to.split('.');
    lines.push(`  ${table(toAlias)} ||--o{ ${table(fromAlias)} : "${col}"`);
  }
  if (lines.length === 1) lines.push(`  ${view.tables.map((t) => t.fqn.split('.')[1]).join(' ||--o{ ')} : relates`);
  return lines.join('\n');
}

export function blueprint(pack: Pack, product: DataProduct, type: ArtifactType, facts: BlueprintFacts = {}): ArtifactContent {
  const view = pack.semantic.find((v) => v.name === product.semantic_view);
  const objects = productObjects(pack, product);
  const tags = pack.policies.column_tags.filter((t) => objects.includes(t.column.split('.').slice(0, 2).join('.')));
  const vc = pack.value.find((v) => v.id === product.value_case);
  switch (type) {
    case 'decision-register':
      return { decision: product.decision.decision, decider: product.decision.persona, cadence: product.decision.cadence, workaround: product.decision.workaround, consequence: product.decision.consequence, questions: product.sample_questions };
    case 'charter':
      return { purpose: product.purpose, scope: product.kpis.map((k) => pack.kpis.find((x) => x.id === k)?.name ?? k), outOfScope: ['Record-level lookups for individuals', 'Operational write-back'], owner: personaName(pack, product.owner), steward: personaName(pack, product.steward), consumers: product.consumers };
    case 'value-case':
      return vc
        ? { hypothesis: vc.hypothesis, baseline: vc.baseline, benefitModel: vc.benefit_model, annualValueUsd: vc.annual_value_usd, assumptions: vc.assumptions.map((a) => ({ assumption: a.text, value: a.value, unit: a.unit, source: a.source })) }
        : { hypothesis: `${product.name} removes the manual workaround: ${product.decision.workaround}`, baseline: product.decision.workaround, benefitModel: 'analyst_hours_saved * loaded_rate', annualValueUsd: 0, assumptions: [] };
    case 'source-inventory':
      return { sources: upstreamObjects(pack, product).map((o) => ({ object: o.fqn, layer: o.layer, system: pack.sources.find((s) => `RAW_BRONZE.${s.name}` === o.fqn)?.system ?? 'warehouse', owner: personaName(pack, product.owner) })) };
    case 'profile-report':
      return { profiledAt: facts.asOf ?? pack.manifest.asOf, objects: facts.profile ?? [], findings: (facts.profile ?? []).filter((p) => p.worstNullPct > 0).map((p) => `${p.object}: worst column null rate ${p.worstNullPct}%`) };
    case 'gap-log':
      return { gaps: (facts.profile ?? []).filter((p) => p.worstNullPct > 1).map((p) => ({ gap: `Nulls in ${p.object}`, impact: 'Completeness', resolution: 'Silver rule fills or excludes' })) };
    case 'logical-model':
      return { grain: pack.objects.find((o) => o.fqn === product.upstream[0])?.grain ?? 'one row per business event', entities: objects.map((o) => ({ entity: o.split('.')[1], object: o, keys: '' })), relationships: (view?.relationships ?? []).map((r) => `${r.from} → ${r.to}`) };
    case 'er-diagram':
      return { mermaid: erMermaid(pack, product) };
    case 'attribute-register':
      return {
        attributes: tags.map((t) => ({ column: t.column, type: '', term: pack.glossary.find((g) => g.mappings.columns.includes(t.column))?.id ?? '', classification: t.classes.join(','), cde: t.cde ? 'yes' : 'no' })),
      };
    case 'data-contract':
      return { version: product.version, columns: tags.map((t) => t.column), freshnessMinutes: product.sla.freshness_minutes, availabilityPct: product.sla.availability_pct, maxNullRatePct: product.sla.max_null_rate_pct, support: pack.agents.find((a) => a.products.some((b) => b.id === product.id))?.on_call ?? 'Data platform team' };
    case 'semantic-model':
      return view
        ? { view: view.name, metrics: view.metrics.map((m) => ({ metric: m.name, label: m.label, term: m.term ?? '', unit: m.unit })), dimensions: view.dimensions.map((d) => d.name), verifiedQueries: pack.verifiedQueries.filter((q) => q.query.view === view.name && q.status === 'active').length }
        : { view: '', metrics: [], dimensions: [], verifiedQueries: 0 };
    case 'physical-architecture':
      return { objects: objects.map((o) => ({ object: o, kind: pack.objects.find((x) => x.fqn === o)?.kind ?? 'TABLE', refresh: pack.objects.find((x) => x.fqn === o)?.target_lag ?? 'batch' })), refresh: `Freshness SLA ${product.sla.freshness_minutes} min` };
    case 'lineage-diagram': {
      const g = lineageAround(pack, product.id);
      return { edges: g.edges.map((e) => `${e.from} → ${e.to}`), complete: g.nodes.some((n) => n.layer === 'bronze') ? 'yes' : 'no' };
    }
    case 'quality-rules':
      return { rules: productRules(pack, product).map((r) => ({ rule: r.id, dimension: r.dimension, assertion: `${r.object.split('.')[1]}${r.column ? `.${r.column}` : ''}: ${r.assertion}`, severity: r.severity })), lastScore: facts.qualityScore ?? null };
    case 'runbook':
      return { onCall: pack.agents.find((a) => a.products.some((b) => b.id === product.id))?.on_call ?? 'Data platform team', alerts: [...new Set(productRules(pack, product).map((r) => r.alert_route))].map((r) => `DQ failures → ${r}`), recovery: ['Check the latest DQ run', 'Re-run the Silver transform', 'Notify consumers via the Marketplace banner'] };
    case 'access-policy':
      return {
        classifications: [...new Set(tags.flatMap((t) => t.classes))],
        masking: [...new Set(tags.flatMap((t) => (t.masking ? [t.masking] : [])))],
        rowAccess: pack.policies.row_access_policies.filter((r) => r.bindings.some((b) => objects.includes(b.object))).map((r) => r.id),
        approvers: ['DATA_STEWARD', ...(tags.some((t) => t.classes.length) ? ['PRIVACY_OFFICER'] : [])],
      };
    case 'regulatory-map': {
      const domainId = pack.domains.domains.find((d) => d.name === product.domain)?.id;
      const classes = new Set(tags.flatMap((t) => t.classes));
      return { controls: pack.controls.controls.filter((c) => (domainId && c.applies_to.domains?.includes(domainId)) || c.applies_to.classes?.some((x) => classes.has(x))).map((c) => ({ control: c.id, requirement: c.name, evidence: c.evidence })) };
    }
    case 'serving-spec':
      return { ports: product.output_ports.map((o) => ({ kind: o.kind, ref: o.ref })) };
    case 'marketplace-listing':
      return { name: product.name, summary: product.description, sampleQuestions: product.sample_questions, kpis: product.kpis };
    case 'grounding-pack':
      return { objects: [...(view ? [`SEMANTIC.${view.name}`] : []), ...objects.filter((o) => o.startsWith('CONFORMED_GOLD.'))], documents: pack.agents.filter((a) => a.products.some((b) => b.id === product.id)).flatMap((a) => a.tools.flatMap((t) => (t.tool === 'search_context' ? t.corpora : []))), verifiedQueries: view ? pack.verifiedQueries.filter((q) => q.query.view === view.name && q.status === 'active').map((q) => q.id) : [] };
    case 'certification-scorecard':
      return { checks: facts.checks ?? [], datsis: [] };
    case 'telemetry':
      return { signals: ['Freshness vs SLA', 'DQ score', 'Query volume by consumer', 'Agent answers citing this product'] };
    case 'feedback-log':
      return { entries: [] };
    case 'change-requests':
      return { requests: [] };
    case 'benefit-realisation':
      return vc?.measured ? { measuredUsd: vc.measured.value_usd, period: vc.measured.period, confidence: vc.measured.confidence } : { measuredUsd: null, period: '', confidence: 'low' };
  }
}
