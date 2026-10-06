import type { PackIndex } from '../index-pack';
import type { Pack, Story } from '../schema';
import type { Checks } from './types';

type Range = [min: number, max: number];
interface Quota {
  domains: Range;
  bronze: Range;
  silver: Range;
  gold: Range;
  views: number;
  metrics: number;
  kpis: number;
  terms: number;
  cdePct: number;
  rules: number;
  vqs: number;
  synonyms: number;
  docs: number;
  products: number;
  agents: number;
  scenarios: number;
  scenariosPerAgent: number;
  incidents: number;
}

const INF = Number.POSITIVE_INFINITY;

/** Depth quotas (04 §1). */
export const QUOTAS: Record<'deep' | 'standard', Quota> = {
  deep: { domains: [5, 8], bronze: [14, 20], silver: [12, 18], gold: [10, 14], views: 4, metrics: 24, kpis: 24, terms: 26, cdePct: 30, rules: 20, vqs: 48, synonyms: 30, docs: 6, products: 8, agents: 5, scenarios: 20, scenariosPerAgent: 4, incidents: 5 },
  standard: { domains: [3, 5], bronze: [8, 12], silver: [6, 10], gold: [5, 8], views: 2, metrics: 10, kpis: 10, terms: 12, cdePct: 30, rules: 8, vqs: 16, synonyms: 12, docs: 3, products: 4, agents: 2, scenarios: 8, scenariosPerAgent: 2, incidents: 3 },
};

/** Category 3 — depth quotas incl. product status mix, agent status mix and pattern coverage. */
export function checkQuotas(c: Checks, pack: Pack): void {
  if (pack.manifest.depth === 'draft') return;
  const q = QUOTAS[pack.manifest.depth];
  const between = (n: number, [lo, hi]: Range, what: string) => c.expect(n >= lo && n <= hi, `quota.${what}`, `${what}: ${n} (quota ${lo}–${hi === INF ? '∞' : hi})`);
  const atLeast = (n: number, min: number, what: string) => c.expect(n >= min, `quota.${what}`, `${what}: ${n} (quota ≥ ${min})`);
  between(pack.domains.domains.length, q.domains, 'domains');
  between(pack.sources.length, q.bronze, 'bronze_tables');
  between(pack.objects.filter((o) => o.fqn.startsWith('CURATED_SILVER.')).length, q.silver, 'silver_objects');
  between(pack.objects.filter((o) => o.fqn.startsWith('CONFORMED_GOLD.')).length, q.gold, 'gold_objects');
  atLeast(pack.semantic.length, q.views, 'semantic_views');
  atLeast(pack.semantic.reduce((n, v) => n + v.metrics.length, 0), q.metrics, 'metrics');
  atLeast(pack.kpis.length, q.kpis, 'kpis');
  atLeast(pack.glossary.length, q.terms, 'glossary_terms');
  const cdePct = pack.glossary.length ? (100 * pack.glossary.filter((t) => t.cde).length) / pack.glossary.length : 0;
  atLeast(Math.round(cdePct), q.cdePct, 'glossary_cde_pct');
  atLeast(pack.rules.length, q.rules, 'business_rules');
  atLeast(pack.verifiedQueries.filter((v) => v.status === 'active').length, q.vqs, 'verified_queries');
  atLeast(pack.synonyms.length, q.synonyms, 'synonyms');
  atLeast(pack.docs.length, q.docs, 'context_documents');
  atLeast(pack.incidents.length, q.incidents, 'incidents');

  const status = (s: string) => pack.products.filter((p) => p.initial_status === s).length;
  c.expect(pack.products.length === q.products, 'quota.products', `products: ${pack.products.length} (quota ${q.products})`);
  if (pack.manifest.depth === 'deep') {
    c.expect(status('CERTIFIED') === 5 && status('IN_CERTIFICATION') === 1 && status('IN_DEVELOPMENT') === 1 && status('DRAFT') === 1, 'quota.product_mix', 'deep packs need 5 Certified, 1 In certification, 1 In development, 1 Draft');
    const prod = pack.agents.filter((a) => a.status === 'PRODUCTION').length;
    c.expect(pack.agents.length === 5 && prod === 4 && pack.agents.filter((a) => a.status === 'PILOT').length === 1, 'quota.agent_mix', 'deep packs need 5 agents: 4 Production, 1 Pilot');
  } else {
    c.expect(status('CERTIFIED') === 3 && status('IN_CERTIFICATION') === 1, 'quota.product_mix', 'standard packs need 3 Certified and 1 In certification');
    c.expect(pack.agents.length === q.agents, 'quota.agents', `agents: ${pack.agents.length} (quota ${q.agents})`);
  }
  atLeast(pack.scenarios.length, q.scenarios, 'scenarios');
  for (const a of pack.agents.filter((x) => x.status === 'PRODUCTION')) {
    const n = pack.scenarios.filter((s) => s.agent === a.id && s.kind === 'answer').length;
    c.expect(n >= q.scenariosPerAgent, 'quota.scenarios_per_agent', `${a.id}: ${n} answer scenarios (quota ≥ ${q.scenariosPerAgent})`, a.id);
  }
  if (pack.manifest.depth === 'deep') {
    const covered = new Set(pack.scenarios.map((s) => s.pattern));
    for (let p = 1; p <= 15; p++) c.expect(covered.has(p), 'quota.pattern', `scenario pattern ${p} not covered`, `pattern ${p}`);
  }
}

/** Category 5 — semantics: KPI ↔ metric ↔ product, metrics have terms, CDE columns have DQ rules. */
export function checkSemantics(c: Checks, pack: Pack, idx: PackIndex): void {
  for (const k of pack.kpis) {
    const view = idx.metricView.get(k.metric);
    if (!view) continue;
    c.expect(k.products.some((p) => view.products.includes(p)), 'semantics.kpi_product', `${k.id}: metric ${k.metric} lives in ${view.name}, which none of the KPI's products publish`, k.id);
  }
  for (const v of pack.semantic) {
    for (const m of v.metrics) c.expect(idx.terms.has(m.term), 'semantics.metric_term', `${v.name}.${m.name}: needs a glossary term`, `${v.name}.${m.name}`);
  }
  for (const t of pack.policies.column_tags.filter((x) => x.cde)) {
    const [schema, obj, col] = t.column.split('.');
    const has = pack.dq.some((d) => d.object === `${schema}.${obj}` && d.column === col);
    c.expect(has, 'semantics.cde_dq', `CDE ${t.column} has no DQ rule`, t.column);
  }
  for (const t of pack.glossary.filter((x) => x.cde)) {
    c.expect(t.mappings.columns.length + t.mappings.metrics.length > 0, 'semantics.cde_term_mapping', `CDE term ${t.id} maps to no column or metric`, t.id);
  }
  for (const p of pack.products.filter((x) => x.initial_status === 'CERTIFIED')) {
    const view = p.semantic_view ? idx.views.get(p.semantic_view) : undefined;
    c.expect(Boolean(view), 'semantics.certified_view', `${p.id}: certified products need a semantic view`, p.id);
    c.expect(p.kpis.length > 0, 'semantics.certified_kpis', `${p.id}: certified products need KPIs`, p.id);
  }
}

const SENSITIVE_NAME = /(^|_)(email|phone|first_name|last_name|full_name|street_address|card_number|tax_id|ssn|date_of_birth)$/;

/** Category 6 — governance: tags, masking on certified outputs, grants, row filters. */
export function checkGovernance(c: Checks, pack: Pack, idx: PackIndex): void {
  const tags = new Map(pack.policies.column_tags.map((t) => [t.column, t]));
  for (const s of pack.sources) {
    for (const col of s.columns) {
      if (SENSITIVE_NAME.test(col.name)) c.expect(col.tags.length > 0, 'governance.bronze_tag', `RAW_BRONZE.${s.name}.${col.name} looks sensitive but has no tag`, `${s.name}.${col.name}`);
    }
  }
  const classes = new Set(pack.policies.masking_policies.map((m) => m.class));
  for (const t of pack.policies.column_tags) {
    for (const cls of t.classes) {
      c.expect(classes.has(cls), 'governance.class_policy', `${t.column}: no masking policy for class ${cls}`, t.column);
      c.expect(Boolean(t.masking), 'governance.tag_masking', `${t.column}: sensitive column has no masking policy`, t.column);
    }
  }
  // Certified products: every sensitive column reachable through their semantic view must be masked (not pending a fix).
  for (const p of pack.products.filter((x) => x.initial_status === 'CERTIFIED' && x.semantic_view)) {
    const view = idx.views.get(p.semantic_view as string);
    if (!view) continue;
    const alias = new Map(view.tables.map((t) => [t.alias, t.fqn]));
    for (const d of view.dimensions) {
      const m = /^([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/.exec(d.expr.trim());
      if (!m) continue;
      const tag = tags.get(`${alias.get(m[1] ?? '')}.${m[2]}`);
      if (tag && tag.classes.length > 0) {
        c.expect(Boolean(tag.masking) && !tag.mask_pending_fix, 'governance.certified_masking', `${p.id}: ${view.name}.${d.name} exposes ${tag.column} without attached masking`, p.id);
      }
    }
  }
  for (const persona of pack.personas) {
    const g = pack.policies.grants.find((x) => x.persona === persona.id);
    c.expect(Boolean(g && g.products.length > 0), 'governance.persona_grant', `${persona.id}: needs at least one entitlement`, persona.id);
    if (persona.row_filter) {
      const dim = persona.row_filter.dimension;
      c.expect(pack.policies.row_access_policies.some((r) => r.dimension === dim), 'governance.row_filter_policy', `${persona.id}: no row access policy on "${dim}"`, persona.id);
      for (const v of persona.row_filter.allowed) c.expect(pack.manifest.regions.includes(v) || dim !== 'region', 'governance.row_filter_value', `${persona.id}: unknown region "${v}"`, persona.id);
    }
  }
  const a = pack.personas.find((p) => p.archetype === 'A');
  c.expect(Boolean(a?.row_filter), 'governance.archetype_a_filter', 'archetype A must have a row filter');
  const d = pack.personas.find((p) => p.archetype === 'D');
  c.expect(Boolean(d?.roles.includes('DATA_STEWARD') && d.unmasked.length > 0), 'governance.archetype_d', 'archetype D must be a data steward with unmasked classes');
  const e = pack.personas.find((p) => p.archetype === 'E');
  c.expect(Boolean(e?.aggregates_only), 'governance.archetype_e', 'archetype E sees aggregates only');
  const injected = pack.docs.filter((x) => x.meta.contains_injection).length;
  if (pack.manifest.depth === 'deep') c.expect(injected >= 2, 'governance.planted_injections', `deep packs plant ≥ 2 prompt-injection lines in documents (found ${injected})`);
}

/** Routes a story step may navigate to (route names below `/[pack]/`). */
export const STORY_ROUTES = new Set([
  'home', 'marketplace', 'ask', 'access', 'request/new', 'studio', 'factory', 'explorer', 'semantic', 'glossary', 'context',
  'health', 'agent-quality', 'cost-value', 'impact', 'audit', 'platform-map', 'why/knockout', 'why/compare', 'readiness',
  'roadmap', 'portfolio', 'operating-model', 'admin',
]);

/** Category 9 — every story step's targets exist in the pack; overrides point at real steps. */
export function checkStories(c: Checks, pack: Pack, idx: PackIndex, stories: Story[]): void {
  const roles = pack.manifest.story_roles;
  const resolves: Record<keyof typeof roles, (id: string) => boolean> = {
    heroScenario: (id) => idx.scenarios.has(id),
    certDemoProduct: (id) => idx.products.has(id),
    lifecycleDemoProduct: (id) => idx.products.has(id),
    incidentForStory: (id) => idx.incidents.has(id),
    knockoutKpi: (id) => idx.kpis.has(id),
    qualityFixAgent: (id) => idx.agents.has(id),
  };
  for (const s of stories) {
    for (const step of s.steps) {
      const where = `${s.id}/${step.id}`;
      c.expect(STORY_ROUTES.has(step.go.route), 'stories.route', `${where}: unknown route "${step.go.route}"`, where);
      c.expect(pack.personas.some((p) => p.archetype === step.go.persona), 'stories.persona', `${where}: no persona with archetype ${step.go.persona}`, where);
      for (const t of step.targets) c.expect(resolves[t](roles[t]), 'stories.target', `${where}: story role ${t} → ${roles[t]} does not resolve`, where);
    }
  }
  for (const o of pack.storyOverrides) {
    const story = stories.find((s) => s.id === o.story);
    c.expect(Boolean(story?.steps.some((st) => st.id === o.step)), 'stories.override', `override targets unknown step ${o.story}/${o.step}`);
  }
}

/** Category 10 — the term list the domain-string lint (invariant I01) keeps out of src/. */
/**
 * Keystone platform vocabulary (CLAUDE.md §5, 01 §M3): words every industry uses for the platform's own
 * concepts. A pack object that happens to share one (e.g. a CONTRACT source table) does not make the
 * word industry-specific (ADR-0016).
 */
export const PLATFORM_VOCABULARY = new Set(['contract', 'contracts']);

export function lintTerms(pack: Pack): string[] {
  const m = pack.manifest;
  const terms = [
    m.company.name,
    m.company.hq,
    m.database,
    m.industry,
    ...m.lint_terms,
    ...pack.products.map((p) => p.name),
    ...pack.agents.map((a) => a.name),
    ...pack.kpis.map((k) => k.name),
    ...pack.semantic.map((v) => v.name),
    ...pack.sources.map((s) => s.name),
    ...pack.objects.map((o) => o.fqn.split('.')[1] as string),
    ...pack.personas.map((p) => p.name),
    ...pack.personas.map((p) => p.title),
    ...pack.domains.domains.map((d) => d.name),
  ];
  return [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 4 && !PLATFORM_VOCABULARY.has(t.toLowerCase())))].sort();
}
