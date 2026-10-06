/**
 * Impact analysis (01 §M10 Impact; ported in spirit from AI-Ready `ext/impact.ts`): pick an object or column
 * and a change → everything downstream (objects, semantic views, metrics, KPIs, products, agents,
 * consumers), a severity, a contract version bump, a notice period and a generated change plan.
 * Pure over pack metadata; also used for an incident's blast radius.
 */
import { estateLineage, type LineageEdge, type LineageNode } from '@/lib/packs/lineage';
import type { Pack, Rubrics } from '@/lib/packs/schema';

export type ChangeKind = 'rename' | 'drop' | 'type_change' | 'add' | 'delay';

export interface ImpactTarget {
  fqn: string;
  column?: string;
  change: ChangeKind;
}

export interface ImpactResult {
  target: ImpactTarget;
  objects: string[];
  views: string[];
  metrics: { view: string; name: string; label: string }[];
  kpis: { id: string; name: string }[];
  products: { id: string; name: string; status: string; consumers: string[] }[];
  agents: { id: string; name: string; status: string }[];
  consumers: string[];
  severity: 'high' | 'medium' | 'low';
  bump: 'major' | 'minor' | 'patch' | 'none';
  noticeDays: number;
  plan: string[];
  graph: { nodes: LineageNode[]; edges: LineageEdge[] };
}

/** Every node reachable downstream of `id` in the estate lineage. */
function downstream(edges: LineageEdge[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const e of edges) {
      if (!frontier.includes(e.from) || out.has(e.to)) continue;
      out.add(e.to);
      next.push(e.to);
    }
    frontier = next;
  }
  return out;
}

const mentionsColumn = (expr: string, column: string) => new RegExp(`(^|[^A-Za-z0-9_])${column}([^A-Za-z0-9_]|$)`, 'i').test(expr);

export function impactOf(pack: Pack, rubrics: Rubrics, target: ImpactTarget, status: (productId: string) => string = (id) => pack.products.find((p) => p.id === id)?.initial_status ?? 'DRAFT'): ImpactResult {
  const lineage = estateLineage(pack);
  const reach = downstream(lineage.edges, target.fqn);
  const objects = [...reach].filter((id) => lineage.nodes.find((n) => n.id === id)?.kind === 'object' && id !== target.fqn).sort();

  // Semantic views: downstream ones, narrowed to those that use the column when one is named.
  const views = pack.semantic.filter((v) => reach.has(`SEMANTIC.${v.name}`));
  const touchesView = (v: (typeof views)[number]) => {
    if (!target.column) return true;
    const tables = v.tables.filter((t) => t.fqn === target.fqn || reach.has(t.fqn)).map((t) => t.alias);
    const exprs = [...v.metrics.map((m) => m.expr), ...v.dimensions.map((d) => d.expr), ...v.time_dimensions.map((d) => d.expr), ...v.relationships.flatMap((r) => [r.from, r.to])];
    return tables.length > 0 && exprs.some((e) => mentionsColumn(e, target.column ?? ''));
  };
  const hitViews = views.filter(touchesView);
  const metrics = hitViews.flatMap((v) => v.metrics.filter((m) => !target.column || mentionsColumn(m.expr, target.column) || v.metrics.length === 0).map((m) => ({ view: v.name, name: m.name, label: m.label })));
  // A dimension-only column still affects every metric sliced by it.
  const viaDims = hitViews.filter((v) => target.column && v.dimensions.some((d) => mentionsColumn(d.expr, target.column ?? '')));
  for (const v of viaDims) for (const m of v.metrics) if (!metrics.some((x) => x.view === v.name && x.name === m.name)) metrics.push({ view: v.name, name: m.name, label: m.label });
  const metricNames = new Set(metrics.map((m) => m.name));
  const kpis = pack.kpis.filter((k) => metricNames.has(k.metric)).map((k) => ({ id: k.id, name: k.name }));

  const productIds = new Set(
    pack.products
      .filter((p) => (p.semantic_view ? hitViews.some((v) => v.name === p.semantic_view) : reach.has(p.id)) || (!target.column && reach.has(p.id)) || p.upstream.includes(target.fqn))
      .map((p) => p.id),
  );
  const products = pack.products.filter((p) => productIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, status: status(p.id), consumers: p.consumers }));
  const agents = pack.agents.filter((a) => a.products.some((p) => productIds.has(p.id))).map((a) => ({ id: a.id, name: a.name, status: a.status }));
  const consumers = [...new Set(products.flatMap((p) => p.consumers))].sort();

  const breaking = target.change === 'rename' || target.change === 'drop' || target.change === 'type_change';
  const certified = products.some((p) => p.status === 'CERTIFIED');
  const production = agents.some((a) => a.status === 'PRODUCTION');
  const exposed = metrics.length > 0;
  const severity: ImpactResult['severity'] = breaking && (certified || production) ? 'high' : breaking || (target.change === 'delay' && certified) ? 'medium' : 'low';
  const bump: ImpactResult['bump'] = !products.length ? 'none' : breaking && exposed ? 'major' : target.change === 'add' ? 'minor' : 'patch';
  const noticeDays = bump === 'major' ? rubrics.contracts.breaking_notice_days : 0;

  const col = target.column ? `${target.fqn}.${target.column}` : target.fqn;
  const plan: string[] = [];
  if (breaking) plan.push(`Keep ${col} stable in Silver: map the new shape back to the contracted name until consumers migrate.`);
  if (bump === 'major') plan.push(`Raise a major contract version for ${products.map((p) => p.id).join(', ')} and send a ${noticeDays}-day notice to ${consumers.length ? consumers.join(', ') : 'registered consumers'}.`);
  if (bump === 'minor') plan.push(`Publish a minor version for ${products.map((p) => p.id).join(', ')}; existing consumers are unaffected.`);
  if (metrics.length) plan.push(`Re-run verified queries and golden answers for ${[...new Set(metrics.map((m) => m.view))].join(', ')} (${metrics.length} metric(s)).`);
  if (agents.length) plan.push(`Re-evaluate ${agents.map((a) => a.id).join(', ')} before and after the change; hold releases on a failing suite.`);
  if (target.change === 'delay') plan.push('Check freshness SLAs of the affected products and post a status banner while data is late.');
  plan.push('Run the DQ rules on the changed object and record the result as gate evidence.');

  const keep = new Set([target.fqn, ...reach]);
  return {
    target,
    objects,
    views: hitViews.map((v) => v.name),
    metrics,
    kpis,
    products,
    agents,
    consumers,
    severity,
    bump,
    noticeDays,
    plan,
    graph: { nodes: lineage.nodes.filter((n) => keep.has(n.id)), edges: lineage.edges.filter((e) => keep.has(e.from) && keep.has(e.to)) },
  };
}
