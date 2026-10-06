import { compileFormula } from '../formula';
import type { PackIndex } from '../index-pack';
import type { Pack } from '../schema';
import { checkMetricQuery } from './query-check';
import type { Checks } from './types';

const ALIAS_REF = /\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g;

/** Category 1 — ids carry the pack code and are unique. */
export function checkIdentity(c: Checks, pack: Pack): void {
  const code = pack.manifest.code;
  const groups: [string, string[]][] = [
    ['product', pack.products.map((p) => p.id)],
    ['agent', pack.agents.map((a) => a.id)],
    ['kpi', pack.kpis.map((k) => k.id)],
    ['term', pack.glossary.map((t) => t.id)],
    ['rule', pack.rules.map((r) => r.id)],
    ['verified query', pack.verifiedQueries.map((q) => q.id)],
    ['scenario', pack.scenarios.map((s) => s.id)],
    ['instruction', pack.instructions.map((i) => i.id)],
    ['document', pack.docs.map((d) => d.meta.id)],
    ['dq rule', pack.dq.map((d) => d.id)],
    ['incident', pack.incidents.map((i) => i.id)],
    ['value case', pack.value.map((v) => v.id)],
    ['control', pack.controls.controls.map((x) => x.id)],
    ['plant', pack.sources.flatMap((s) => s.plant.map((p) => p.id))],
    ['request', pack.demand.requests.map((r) => r.id)],
    ['demand item', pack.demand.demand_items.map((d) => d.id)],
  ];
  for (const [kind, ids] of groups) {
    const seen = new Set<string>();
    for (const id of ids) {
      c.expect(id.split('-')[1] === code, 'schema.id.code', `${kind} id ${id} must use pack code ${code}`, id);
      c.expect(!seen.has(id), 'schema.id.unique', `duplicate ${kind} id ${id}`, id);
      seen.add(id);
    }
  }
  for (const p of pack.personas) c.expect(p.id.startsWith(`${pack.manifest.id}:`), 'schema.persona.prefix', `persona ${p.id} must be prefixed "${pack.manifest.id}:"`, p.id);
  const archetypes = pack.personas.map((p) => p.archetype).sort().join('');
  c.expect(archetypes === 'ABCDE', 'schema.persona.archetypes', `personas must cover archetypes A–E exactly once (got ${archetypes})`);

  const metricNames = pack.semantic.flatMap((v) => v.metrics.map((m) => m.name));
  const dupMetrics = metricNames.filter((m, i) => metricNames.indexOf(m) !== i);
  c.expect(dupMetrics.length === 0, 'schema.metric.unique', `metric names must be unique across views: ${dupMetrics.join(', ')}`);
  const viewNames = pack.semantic.map((v) => v.name);
  c.expect(new Set(viewNames).size === viewNames.length, 'schema.view.unique', 'semantic view names must be unique');
  for (const v of pack.semantic) {
    const names = [...v.dimensions, ...v.time_dimensions, ...v.facts, ...v.metrics].map((x) => x.name);
    const dups = names.filter((n, i) => names.indexOf(n) !== i);
    c.expect(dups.length === 0, 'schema.view.field_unique', `${v.name}: duplicate field names ${dups.join(', ')}`, v.name);
    c.expect(v.time_dimensions.filter((t) => t.default).length <= 1, 'schema.view.default_time', `${v.name}: at most one default time dimension`, v.name);
  }
}

/** Category 2 — Bronze generator references resolve (fk, derive_from, templates, formulas, plants). */
export function checkSources(c: Checks, pack: Pack): void {
  const tables = new Map(pack.sources.map((t) => [t.name, t]));
  for (const t of pack.sources) {
    const where = `RAW_BRONZE.${t.name}`;
    const cols = new Map(t.columns.map((col) => [col.name, col]));
    c.expect(cols.has(t.key), 'ref.source.key', `${where}: key column "${t.key}" not declared`, where);
    if (t.loaded_at_from) c.expect(['DATE', 'TIMESTAMP'].includes(cols.get(t.loaded_at_from)?.type ?? ''), 'ref.source.loaded_at', `${where}: loaded_at_from must be a DATE/TIMESTAMP column`, where);
    const earlier = new Set<string>();
    for (const col of t.columns) {
      const at = `${where}.${col.name}`;
      const g = col.gen;
      if ('fk' in g) {
        const parent = tables.get(g.fk.table);
        if (c.expect(Boolean(parent), 'ref.source.fk_table', `${at}: fk table ${g.fk.table} not declared`, at) && parent) {
          c.expect(parent.columns.some((p) => p.name === g.fk.column), 'ref.source.fk_column', `${at}: fk column ${g.fk.table}.${g.fk.column} not declared`, at);
        }
      }
      if ('derive_from' in g) {
        const fkCol = cols.get(g.derive_from.fk_column);
        const fkGen = fkCol?.gen;
        const ok = c.expect(earlier.has(g.derive_from.fk_column) && Boolean(fkGen && 'fk' in fkGen), 'ref.source.derive_fk', `${at}: derive_from needs an earlier fk column "${g.derive_from.fk_column}"`, at);
        if (ok && fkGen && 'fk' in fkGen) {
          const parent = tables.get(fkGen.fk.table);
          c.expect(Boolean(parent?.columns.some((p) => p.name === g.derive_from.parent_column)), 'ref.source.derive_column', `${at}: parent column ${fkGen.fk.table}.${g.derive_from.parent_column} not declared`, at);
        }
      }
      if ('template' in g) {
        for (const m of g.template.matchAll(/\{([a-z_][a-z0-9_]*)\}/g)) c.expect(earlier.has(m[1] ?? ''), 'ref.source.template', `${at}: template references "${m[1]}", not an earlier column`, at);
      }
      if ('formula' in g) {
        let err = '';
        try {
          compileFormula(g.formula, earlier);
        } catch (e) {
          err = (e as Error).message;
        }
        c.expect(err === '', 'ref.source.formula', `${at}: ${err}`, at);
      }
      if ('email' in g) c.expect(earlier.has(g.email.first) && earlier.has(g.email.last), 'ref.source.email', `${at}: email needs earlier first/last columns`, at);
      if ('date_offset' in g) c.expect(earlier.has(g.date_offset.from_column), 'ref.source.date_offset', `${at}: date_offset needs an earlier column "${g.date_offset.from_column}"`, at);
      earlier.add(col.name);
    }
    for (const p of t.plant) {
      for (const col of [...Object.keys(p.where), ...Object.keys(p.adjust), ...(p.window ? [p.window.column] : [])]) {
        c.expect(cols.has(col), 'ref.source.plant_column', `${where} ${p.id}: unknown column "${col}"`, p.id);
      }
    }
  }
}

/** Category 2 — Silver/Gold SQL files and objects.yaml agree; upstream edges resolve. */
export function checkObjects(c: Checks, pack: Pack, idx: PackIndex): void {
  const created = new Set<string>();
  for (const f of pack.sql) {
    for (const m of f.sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+([A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*)/g)) {
      const fqn = m[1] as string;
      created.add(fqn);
      const expected = f.layer === 'silver' ? 'CURATED_SILVER.' : 'CONFORMED_GOLD.';
      c.expect(fqn.startsWith(expected), 'ref.sql.schema', `${f.path} creates ${fqn} outside ${expected.slice(0, -1)}`, f.path);
    }
  }
  const declared = new Set(pack.objects.map((o) => o.fqn));
  for (const fqn of created) c.expect(declared.has(fqn), 'ref.objects.declared', `${fqn} is created by SQL but missing from warehouse/objects.yaml`, fqn);
  for (const o of pack.objects) {
    c.expect(created.has(o.fqn), 'ref.objects.created', `${o.fqn} is declared in objects.yaml but no SQL creates it`, o.fqn);
    for (const up of o.upstream) c.ref(idx.objects, up, 'ref.objects.upstream', o.fqn);
  }
}

/** Category 2 — semantic views: tables, aliases, terms, rules, products. */
export function checkSemantic(c: Checks, pack: Pack, idx: PackIndex): void {
  const terms = new Set(idx.terms.keys());
  for (const v of pack.semantic) {
    const aliases = new Set(v.tables.map((t) => t.alias));
    for (const t of v.tables) c.ref(idx.objects, t.fqn, 'ref.semantic.table', `${v.name}.${t.alias}`);
    for (const r of v.relationships) {
      c.expect(aliases.has(r.from.split('.')[0] ?? ''), 'ref.semantic.relationship', `${v.name}: relationship ${r.from} uses an unknown alias`, v.name);
      c.expect(aliases.has(r.to.split('.')[0] ?? ''), 'ref.semantic.relationship', `${v.name}: relationship ${r.to} uses an unknown alias`, v.name);
    }
    const exprs = [
      ...v.dimensions.map((d) => [d.name, d.expr] as const),
      ...v.time_dimensions.map((d) => [d.name, d.expr] as const),
      ...v.facts.map((d) => [d.name, d.expr] as const),
      ...v.metrics.flatMap((m) => [[m.name, m.expr] as const, ...(m.naive_expr ? [[`${m.name}.naive`, m.naive_expr] as const] : []), ...m.scope_exprs.map((s) => [`${m.name}@${s.dimension}`, s.expr] as const)]),
    ];
    for (const [name, expr] of exprs) {
      for (const m of expr.matchAll(ALIAS_REF)) {
        c.expect(aliases.has(m[1] ?? ''), 'ref.semantic.alias', `${v.name}.${name}: expression uses unknown alias "${m[1]}"`, `${v.name}.${name}`);
      }
    }
    const dims = new Set(v.dimensions.map((d) => d.name));
    for (const d of v.dimensions) c.ref(terms, d.term, 'ref.semantic.term', `${v.name}.${d.name}`);
    for (const m of v.metrics) {
      c.ref(terms, m.term, 'ref.semantic.term', `${v.name}.${m.name}`);
      for (const s of m.scope_exprs) c.expect(dims.has(s.dimension), 'ref.semantic.scope_dimension', `${v.name}.${m.name}: scope dimension "${s.dimension}" not in view`, `${v.name}.${m.name}`);
      for (const f of m.default_filters) {
        const rule = idx.rules.get(f.rule);
        if (c.ref(new Set(idx.rules.keys()), f.rule, 'ref.semantic.rule', `${v.name}.${m.name}`) && rule?.apply) {
          c.expect(dims.has(rule.apply.filter.dimension), 'ref.semantic.rule_dimension', `${v.name}.${m.name}: rule ${rule.id} filters on "${rule.apply.filter.dimension}", not a dimension of ${v.name}`, `${v.name}.${m.name}`);
        }
      }
    }
    for (const p of v.products) c.ref(new Set(idx.products.keys()), p, 'ref.semantic.product', v.name);
  }
}

/** Category 2 — everything else that points at something. */
export function checkReferences(c: Checks, pack: Pack, idx: PackIndex): void {
  const P = new Set(idx.products.keys());
  const A = new Set(idx.agents.keys());
  const K = new Set(idx.kpis.keys());
  const T = new Set(idx.terms.keys());
  const R = new Set(idx.rules.keys());
  const S = new Set(idx.scenarios.keys());
  const D = new Set(idx.docs.keys());
  const PER = new Set(idx.personas.keys());
  const I = new Set(idx.instructions.keys());
  const INC = new Set(idx.incidents.keys());
  const VC = new Set(idx.valueCases.keys());
  const M = new Set(idx.metricView.keys());
  const VIEWS = new Set(idx.views.keys());
  const m = pack.manifest;

  for (const k of m.home.headlineKpis) c.ref(K, k, 'ref.pack.kpi', 'pack.home.headlineKpis');
  for (const s of m.home.theatreScenarios) c.ref(S, s, 'ref.pack.scenario', 'pack.home.theatreScenarios');
  c.ref(A, m.home.heroAgent, 'ref.pack.agent', 'pack.home.heroAgent');
  const roles = m.story_roles;
  c.ref(S, roles.heroScenario, 'ref.pack.scenario', 'pack.story_roles.heroScenario');
  c.ref(P, roles.certDemoProduct, 'ref.pack.product', 'pack.story_roles.certDemoProduct');
  c.ref(P, roles.lifecycleDemoProduct, 'ref.pack.product', 'pack.story_roles.lifecycleDemoProduct');
  c.ref(INC, roles.incidentForStory, 'ref.pack.incident', 'pack.story_roles.incidentForStory');
  c.ref(K, roles.knockoutKpi, 'ref.pack.kpi', 'pack.story_roles.knockoutKpi');
  c.ref(A, roles.qualityFixAgent, 'ref.pack.agent', 'pack.story_roles.qualityFixAgent');
  const cert = idx.products.get(roles.certDemoProduct);
  c.expect(cert?.initial_status === 'IN_CERTIFICATION' && cert.certification_script !== null, 'ref.pack.cert_demo', 'certDemoProduct must be IN_CERTIFICATION with a certification_script');
  c.expect(idx.products.get(roles.lifecycleDemoProduct)?.initial_status === 'IN_DEVELOPMENT', 'ref.pack.lifecycle_demo', 'lifecycleDemoProduct must be IN_DEVELOPMENT');
  c.expect(Boolean(idx.agents.get(roles.qualityFixAgent)?.quality_fix), 'ref.pack.quality_fix', 'qualityFixAgent must declare quality_fix');

  for (const d of pack.domains.domains) c.ref(PER, d.owner, 'ref.domain.persona', `domain ${d.id}`);
  for (const g of pack.policies.grants) {
    c.ref(PER, g.persona, 'ref.grant.persona', 'policies.grants');
    for (const p of g.products) c.ref(P, p, 'ref.grant.product', `grant ${g.persona}`);
    for (const a of g.agents) c.ref(A, a, 'ref.grant.agent', `grant ${g.persona}`);
  }
  for (const p of pack.policies.public_products) c.ref(P, p, 'ref.policy.public_product', 'policies.public_products');
  const masking = new Set(pack.policies.masking_policies.map((x) => x.id));
  const fixIds = new Set(pack.products.flatMap((p) => p.certification_script?.fixes.map((f) => f.id) ?? []));
  for (const r of pack.policies.row_access_policies) for (const b of r.bindings) c.ref(idx.objects, b.object, 'ref.policy.rap_object', r.id);
  for (const t of pack.policies.column_tags) {
    const obj = t.column.split('.').slice(0, 2).join('.');
    c.ref(idx.objects, obj, 'ref.policy.tag_object', t.column);
    c.ref(masking, t.masking, 'ref.policy.masking', t.column);
    c.ref(fixIds, t.mask_pending_fix, 'ref.policy.fix', t.column);
  }

  for (const k of pack.kpis) {
    c.ref(T, k.term, 'ref.kpi.term', k.id);
    c.ref(M, k.metric, 'ref.kpi.metric', k.id);
    for (const p of k.products) c.ref(P, p, 'ref.kpi.product', k.id);
    c.expect(k.target.min <= k.target.max, 'ref.kpi.target', `${k.id}: target min > max`, k.id);
  }
  for (const t of pack.glossary) {
    c.ref(PER, t.owner, 'ref.term.persona', t.id);
    c.ref(PER, t.steward, 'ref.term.persona', t.id);
    for (const mm of t.mappings.metrics) c.ref(M, mm, 'ref.term.metric', t.id);
    for (const col of t.mappings.columns) c.ref(idx.objects, col.split('.').slice(0, 2).join('.'), 'ref.term.column_object', t.id);
  }
  for (const i of pack.instructions) {
    c.ref(A, i.agent, 'ref.instruction.agent', i.id);
    const suffix = { persona: 'P', response: 'R', guardrail: 'G', orchestration: 'O' }[i.kind];
    c.expect(i.id.endsWith(`-${suffix}`), 'ref.instruction.kind', `${i.id}: kind ${i.kind} must use suffix -${suffix}`, i.id);
  }
  for (const r of pack.rules) {
    c.ref(M, r.metric, 'ref.rule.metric', r.id);
    c.ref(D, r.source_doc, 'ref.rule.doc', r.id);
    if (r.apply && r.metric) {
      const view = idx.metricView.get(r.metric);
      if (view) c.expect(view.dimensions.some((d) => d.name === r.apply?.filter.dimension), 'ref.rule.dimension', `${r.id}: filter dimension "${r.apply.filter.dimension}" not in ${view.name}`, r.id);
    }
  }
  for (const q of pack.verifiedQueries) {
    checkMetricQuery(c, idx, q.query, q.id);
    c.ref(A, q.agent, 'ref.vq.agent', q.id);
    c.ref(PER, q.verified_by, 'ref.vq.persona', q.id);
    c.expect(q.verified_at <= m.asOf, 'ref.vq.date', `${q.id}: verified_at is after asOf`, q.id);
  }
  for (const s of pack.synonyms) {
    const ref = s.maps_to.ref;
    const where = `synonym "${s.term}"`;
    if (s.maps_to.kind === 'metric') c.ref(M, ref, 'ref.synonym.metric', where);
    else if (s.maps_to.kind === 'term') c.ref(T, ref, 'ref.synonym.term', where);
    else {
      const dim = s.maps_to.kind === 'value' ? ref.split('=')[0] : ref;
      c.expect(pack.semantic.some((v) => v.dimensions.some((d) => d.name === dim)), 'ref.synonym.dimension', `${where}: dimension "${dim}" not in any view`, where);
      if (s.maps_to.kind === 'value') c.expect(ref.includes('='), 'ref.synonym.value', `${where}: value refs use "<dimension>=<value>"`, where);
    }
  }
  for (const d of pack.docs) c.ref(PER, d.meta.owner, 'ref.doc.persona', d.meta.id);

  for (const p of pack.products) {
    c.ref(PER, p.owner, 'ref.product.persona', p.id);
    c.ref(PER, p.steward, 'ref.product.persona', p.id);
    c.ref(VIEWS, p.semantic_view, 'ref.product.view', p.id);
    if (p.semantic_view) c.expect(Boolean(idx.views.get(p.semantic_view)?.products.includes(p.id)), 'ref.product.view_products', `${p.id}: semantic view ${p.semantic_view} does not list the product`, p.id);
    for (const port of p.output_ports) {
      if (port.kind === 'semantic') c.ref(VIEWS, port.ref, 'ref.product.port_view', p.id);
      if (port.kind === 'agent') c.ref(A, port.ref, 'ref.product.port_agent', p.id);
      if (port.kind === 'sql') c.expect(port.ref.startsWith('DATA_PRODUCTS.'), 'ref.product.port_sql', `${p.id}: sql port ${port.ref} must live in DATA_PRODUCTS`, p.id);
    }
    for (const k of p.kpis) c.ref(K, k, 'ref.product.kpi', p.id);
    for (const u of p.upstream) c.ref(idx.objects, u, 'ref.product.upstream', p.id);
    c.ref(VC, p.value_case, 'ref.product.value_case', p.id);
    for (const fix of p.certification_script?.fixes ?? []) {
      if ('overlay' in fix.effect) {
        for (const key of fix.effect.keys) {
          const vq = idx.vqs.get(key);
          c.expect(vq?.status === 'pending_fix', 'ref.product.fix_vq', `${p.id} ${fix.id}: ${key} must exist with status pending_fix`, p.id);
        }
      } else {
        const effect = fix.effect.policy_attach;
        c.ref(masking, effect.policy, 'ref.product.fix_policy', `${p.id} ${fix.id}`);
        for (const col of effect.columns) {
          c.expect(pack.policies.column_tags.some((t) => t.column === col && t.mask_pending_fix === fix.id), 'ref.product.fix_column', `${p.id} ${fix.id}: ${col} must be tagged mask_pending_fix: ${fix.id}`, p.id);
        }
      }
    }
  }
  for (const a of pack.agents) {
    c.ref(PER, a.owner, 'ref.agent.persona', a.id);
    for (const p of a.products) c.ref(P, p.id, 'ref.agent.product', a.id);
    for (const t of a.tools) {
      if (t.tool === 'semantic_query') for (const v of t.views) c.ref(VIEWS, v, 'ref.agent.view', a.id);
      if (t.tool === 'search_context') for (const d of t.corpora) c.ref(D, d, 'ref.agent.doc', a.id);
    }
    for (const k of a.kpi_coverage) c.ref(K, k.kpi, 'ref.agent.kpi', a.id);
    for (const i of a.instructions) c.ref(I, i, 'ref.agent.instruction', a.id);
    const kinds = new Set(a.instructions.map((i) => idx.instructions.get(i)?.kind));
    c.expect(kinds.size === 4, 'ref.agent.instruction_kinds', `${a.id}: needs one persona, response, guardrail and orchestration instruction`, a.id);
    for (const s of a.scenarios) {
      c.ref(S, s, 'ref.agent.scenario', a.id);
      const sc = idx.scenarios.get(s);
      if (sc) c.expect(sc.agent === a.id, 'ref.agent.scenario_owner', `${a.id} lists ${s}, but the scenario belongs to ${sc.agent}`, a.id);
    }
  }
  for (const s of pack.scenarios) {
    const agent = idx.agents.get(s.agent);
    c.ref(A, s.agent, 'ref.scenario.agent', s.id);
    c.ref(A, s.redirect_to, 'ref.scenario.redirect', s.id);
    c.expect(Boolean(agent?.scenarios.includes(s.id)), 'ref.scenario.listed', `${s.id}: not listed in ${s.agent}.scenarios`, s.id);
    c.expect((s.kind === 'answer') === (s.query !== null), 'ref.scenario.query_kind', `${s.id}: kind "answer" needs a query; other kinds must have query null`, s.id);
    if (s.kind === 'redirect') c.expect(Boolean(s.redirect_to), 'ref.scenario.redirect_to', `${s.id}: redirect needs redirect_to`, s.id);
    if (s.query && agent) {
      const views = new Set(agent.tools.flatMap((t) => (t.tool === 'semantic_query' ? t.views : [])));
      checkMetricQuery(c, idx, s.query, s.id, views);
    }
  }
  for (const i of pack.incidents) {
    c.ref(idx.objects, i.object, 'ref.incident.object', i.id);
    for (const p of i.affects.products) c.ref(P, p, 'ref.incident.product', i.id);
    for (const a of i.affects.agents) c.ref(A, a, 'ref.incident.agent', i.id);
  }
  for (const k of pack.knockout.answers) {
    c.ref(K, k.kpi, 'ref.knockout.kpi', k.id);
    checkMetricQuery(c, idx, k.query, k.id);
  }
  for (const g of pack.knockout.gold_fallbacks) {
    c.ref(idx.objects, g.gold, 'ref.knockout.gold', 'knockout.gold_fallbacks');
    c.ref(idx.objects, g.silver, 'ref.knockout.silver', 'knockout.gold_fallbacks');
  }
  for (const v of pack.value) {
    c.ref(P, v.product, 'ref.value.product', v.id);
    c.expect(idx.products.get(v.product)?.value_case === v.id, 'ref.value.backref', `${v.id}: product ${v.product} does not point back at this value case`, v.id);
  }
  for (const r of pack.demand.requests) c.ref(PER, r.requester, 'ref.demand.persona', r.id);
  for (const d of pack.demand.demand_items) c.ref(PER, d.requested_by, 'ref.demand.persona', d.id);
  for (const ctl of pack.controls.controls) {
    if (ctl.jurisdiction) c.expect(pack.controls.jurisdictions.some((j) => j.id === ctl.jurisdiction), 'ref.control.jurisdiction', `${ctl.id}: unknown jurisdiction`, ctl.id);
  }
  for (const d of pack.dq) c.ref(idx.objects, d.object, 'ref.dq.object', d.id);
}
