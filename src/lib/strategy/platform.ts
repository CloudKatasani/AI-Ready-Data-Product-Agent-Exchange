/**
 * Platform Map (01 §M11): the nine-layer stack for the active pack — what each layer holds, what breaks
 * without it (from the knockout declarations) and the flow path one governed answer takes from a Bronze
 * source to the agent. Pure over pack metadata.
 */
import { LAYERS, type Layer, type Pack } from '@/lib/packs/schema';

export interface LayerCard {
  layer: Layer;
  label: string;
  purpose: string;
  items: { id: string; label: string }[];
  count: number;
  breaks: string[];
}

const LABEL: Record<Layer, string> = {
  bronze: 'Bronze — raw',
  silver: 'Silver — curated',
  gold: 'Gold — conformed',
  semantic: 'Semantic',
  glossary: 'Glossary',
  context: 'Context & knowledge',
  product: 'Data products',
  agent: 'Agents',
  governance: 'Governance',
};

const PURPOSE: Record<Layer, string> = {
  bronze: 'Source-shaped data landed with change capture, duplicates and deletes as they happened.',
  silver: 'Typed, deduplicated and conformed entities with quality rules on critical data elements.',
  gold: 'Star schemas: the conformed facts and dimensions every metric is computed from.',
  semantic: 'Each metric defined once — formula, grain, joins and default rules — for BI and agents alike.',
  glossary: 'Owned business terms and synonyms, mapped to the data, so words resolve to the right metric.',
  context: 'Business rules, verified queries, instructions and documents that give answers judgement.',
  product: 'Certified, versioned, contracted data products with owners, quality and access workflow.',
  agent: 'Agents that answer through the governed path, cite every number and refuse out of scope.',
  governance: 'Classification, masking, row access, certification gates and an append-only audit trail.',
};

const FAILURE_TEXT: Record<string, string> = {
  wrong: 'gives a wrong number',
  unsafe: 'becomes unsafe to share',
  ambiguous: 'becomes ambiguous',
  unverified: 'can no longer be verified',
};

function items(pack: Pack, layer: Layer): { id: string; label: string }[] {
  switch (layer) {
    case 'bronze':
      return pack.sources.map((s) => ({ id: `RAW_BRONZE.${s.name}`, label: s.name }));
    case 'silver':
    case 'gold': {
      const schema = layer === 'silver' ? 'CURATED_SILVER.' : 'CONFORMED_GOLD.';
      return pack.objects.filter((o) => o.fqn.startsWith(schema)).map((o) => ({ id: o.fqn, label: o.fqn.slice(schema.length) }));
    }
    case 'semantic':
      return pack.semantic.map((v) => ({ id: v.name, label: `${v.name} (${v.metrics.length} metrics)` }));
    case 'glossary':
      return pack.glossary.map((t) => ({ id: t.id, label: t.name }));
    case 'context':
      return [...pack.rules.map((r) => ({ id: r.id, label: r.text })), ...pack.verifiedQueries.map((v) => ({ id: v.id, label: v.question }))];
    case 'product':
      return pack.products.map((p) => ({ id: p.id, label: p.name }));
    case 'agent':
      return pack.agents.map((a) => ({ id: a.id, label: a.name }));
    case 'governance':
      return [...pack.policies.masking_policies.map((m) => ({ id: m.id, label: m.id })), ...pack.policies.row_access_policies.map((r) => ({ id: r.id, label: r.id })), ...pack.controls.controls.map((c) => ({ id: c.id, label: c.name }))];
  }
}

export function platformLayers(pack: Pack): LayerCard[] {
  return LAYERS.map((layer) => {
    const all = items(pack, layer);
    const breaks = pack.knockout.answers.flatMap((a) => {
      const f = (a.failure_by_layer as Partial<Record<string, string>>)[layer];
      const kpi = pack.kpis.find((k) => k.id === a.kpi)?.name ?? a.kpi;
      return f ? [`${kpi} ${FAILURE_TEXT[f] ?? f}.`] : [];
    });
    return { layer, label: LABEL[layer], purpose: PURPOSE[layer], items: all.slice(0, 12), count: all.length, breaks };
  });
}

export interface FlowStep {
  layer: Layer;
  id: string;
  label: string;
}

/** The path one governed answer takes for the pack's headline KPI: source → … → agent. */
/** First Bronze source reachable upstream of an object (breadth-first, cycle-safe). */
function bronzeUpstream(pack: Pack, fqn: string): string | undefined {
  const seen = new Set<string>();
  const queue = [fqn];
  while (queue.length) {
    const cur = queue.shift() ?? '';
    if (seen.has(cur)) continue;
    seen.add(cur);
    const up = pack.objects.find((o) => o.fqn === cur)?.upstream ?? [];
    const hit = up.find((u) => u.startsWith('RAW_BRONZE.'));
    if (hit) return hit;
    queue.push(...up);
  }
  return undefined;
}

export function flowPath(pack: Pack): FlowStep[] {
  const ko = pack.knockout.answers.find((a) => a.kpi === pack.manifest.story_roles.knockoutKpi) ?? pack.knockout.answers[0];
  const kpi = pack.kpis.find((k) => k.id === ko?.kpi);
  const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === kpi?.metric));
  const fact = view?.tables[0]?.fqn;
  const goldObj = pack.objects.find((o) => o.fqn === fact);
  // Prefer a Silver input that reaches Bronze (Silver objects may build on other Silver objects).
  const silvers = goldObj?.upstream.filter((u) => u.startsWith('CURATED_SILVER.')) ?? [];
  const bronzeOf = (fqn: string) => bronzeUpstream(pack, fqn);
  const silver = silvers.find((s) => bronzeOf(s)) ?? silvers[0];
  const bronze = silver ? bronzeOf(silver) : undefined;
  const term = pack.glossary.find((t) => t.id === kpi?.term);
  const rule = view?.metrics.find((m) => m.name === kpi?.metric)?.default_filters[0]?.rule;
  const product = pack.products.find((p) => p.semantic_view === view?.name);
  const agent = pack.agents.find((a) => a.products.some((p) => p.id === product?.id));
  const policy = pack.policies.row_access_policies[0];
  const steps: (FlowStep | null)[] = [
    bronze ? { layer: 'bronze', id: bronze, label: bronze } : null,
    silver ? { layer: 'silver', id: silver, label: silver } : null,
    fact ? { layer: 'gold', id: fact, label: fact } : null,
    view && kpi ? { layer: 'semantic', id: `${view.name}.${kpi.metric}`, label: `${view.name} · ${kpi.name}` } : null,
    term ? { layer: 'glossary', id: term.id, label: term.name } : null,
    rule ? { layer: 'context', id: rule, label: pack.rules.find((r) => r.id === rule)?.text ?? rule } : null,
    policy ? { layer: 'governance', id: policy.id, label: policy.id } : null,
    product ? { layer: 'product', id: product.id, label: product.name } : null,
    agent ? { layer: 'agent', id: agent.id, label: agent.name } : null,
  ];
  return steps.filter((s): s is FlowStep => s !== null);
}
