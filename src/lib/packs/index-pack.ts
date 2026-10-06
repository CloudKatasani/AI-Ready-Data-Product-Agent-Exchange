import type { Pack, SemanticView } from './schema';

/** Lookup tables over a loaded pack, shared by the validator and engines. */
export interface PackIndex {
  products: Map<string, Pack['products'][number]>;
  agents: Map<string, Pack['agents'][number]>;
  kpis: Map<string, Pack['kpis'][number]>;
  terms: Map<string, Pack['glossary'][number]>;
  rules: Map<string, Pack['rules'][number]>;
  vqs: Map<string, Pack['verifiedQueries'][number]>;
  scenarios: Map<string, Pack['scenarios'][number]>;
  instructions: Map<string, Pack['instructions'][number]>;
  docs: Map<string, Pack['docs'][number]>;
  personas: Map<string, Pack['personas'][number]>;
  incidents: Map<string, Pack['incidents'][number]>;
  valueCases: Map<string, Pack['value'][number]>;
  views: Map<string, SemanticView>;
  /** Metric name → owning view (metric names are unique per pack). */
  metricView: Map<string, SemanticView>;
  /** Every warehouse object known statically: Bronze sources + Silver/Gold objects.yaml + DATA_PRODUCTS ports. */
  objects: Set<string>;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function indexPack(pack: Pack): PackIndex {
  const views = new Map(pack.semantic.map((v) => [v.name, v]));
  const metricView = new Map<string, SemanticView>();
  for (const v of pack.semantic) for (const m of v.metrics) if (!metricView.has(m.name)) metricView.set(m.name, v);
  const objects = new Set<string>([
    ...pack.sources.map((s) => `RAW_BRONZE.${s.name}`),
    ...pack.objects.map((o) => o.fqn),
    ...pack.products.flatMap((p) => p.output_ports.filter((o) => o.kind === 'sql').map((o) => o.ref)),
  ]);
  return {
    products: byId(pack.products),
    agents: byId(pack.agents),
    kpis: byId(pack.kpis),
    terms: byId(pack.glossary),
    rules: byId(pack.rules),
    vqs: byId(pack.verifiedQueries),
    scenarios: byId(pack.scenarios),
    instructions: byId(pack.instructions),
    docs: new Map(pack.docs.map((d) => [d.meta.id, d])),
    personas: byId(pack.personas),
    incidents: byId(pack.incidents),
    valueCases: byId(pack.value),
    views,
    metricView,
    objects,
  };
}

/** Dimension names (incl. time dimensions) of a view. */
export function viewFields(view: SemanticView): { metrics: Set<string>; dimensions: Set<string>; time: Set<string> } {
  return {
    metrics: new Set(view.metrics.map((m) => m.name)),
    dimensions: new Set(view.dimensions.map((d) => d.name)),
    time: new Set(view.time_dimensions.map((d) => d.name)),
  };
}
