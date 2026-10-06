/**
 * Catalog (01 §M3): product and agent card models, sensitivity, access badges and facets. Pure over the
 * pack plus live records (status/version from the app DB, latest quality snapshots, pending requests).
 */
import { productObjects } from '@/lib/lifecycle/quality';
import type { AgentManifest, DataProduct, Pack, Rubrics, SensitiveClass } from '@/lib/packs/schema';
import type { Principal } from '@/lib/query/types';

export type AccessBadge = 'Granted' | 'Pending' | 'Requestable' | 'Restricted';
export type ProductStatus = 'DRAFT' | 'IN_DEVELOPMENT' | 'IN_CERTIFICATION' | 'CERTIFIED' | 'DEPRECATED' | 'RETIRED';

export interface LiveProduct {
  status: ProductStatus;
  version: string;
  stage: number;
}

export interface QualityView {
  score: number;
  tier: string;
  at: string;
}

export interface ProductCard {
  kind: 'product';
  id: string;
  name: string;
  domain: string;
  description: string;
  status: ProductStatus;
  version: string;
  stage: number;
  quality: QualityView | null;
  sensitivity: SensitiveClass[];
  consumers: string[];
  agents: { id: string; name: string; hue: number }[];
  kpis: { id: string; name: string }[];
  patterns: string[];
  owner: string;
  access: AccessBadge;
  freshnessMinutes: number;
  degraded: boolean;
}

export interface AgentCard {
  kind: 'agent';
  id: string;
  name: string;
  domain: string;
  capability: string;
  status: AgentManifest['status'];
  hue: number;
  products: { id: string; name: string }[];
  kpiCount: number;
  costPerAnswer: number;
  evalGoldenMin: number;
  access: AccessBadge;
}

export interface CatalogState {
  live: Map<string, LiveProduct>;
  quality: Map<string, QualityView>;
  pendingProducts: Set<string>;
  /** Products affected by an open incident (Phase 7). */
  degraded?: Set<string>;
}

export function liveFromPack(p: DataProduct): LiveProduct {
  return { status: p.initial_status, version: p.version, stage: p.seed_stage };
}

/** Sensitive classes tagged on any column of the objects a product reads or exposes. */
export function productSensitivity(pack: Pack, product: DataProduct): SensitiveClass[] {
  const objects = new Set(productObjects(pack, product));
  const classes = new Set<SensitiveClass>();
  for (const t of pack.policies.column_tags) {
    const obj = t.column.split('.').slice(0, 2).join('.');
    if (objects.has(obj)) for (const c of t.classes ?? []) classes.add(c);
  }
  return [...classes].sort();
}

/** Columns that stay masked for this persona even with access (policy preview). */
export function maskedForPersona(pack: Pack, product: DataProduct, who: Principal): string[] {
  const objects = new Set(productObjects(pack, product));
  return pack.policies.column_tags
    .filter((t) => objects.has(t.column.split('.').slice(0, 2).join('.')) && (t.classes ?? []).some((c) => !who.unmasked.includes(c)))
    .map((t) => t.column)
    .sort();
}

/** Auto-approvable: certified, nothing sensitive, and a purpose the rubric marks as internal. */
export function autoApprovable(pack: Pack, rubrics: Rubrics, product: DataProduct, live: LiveProduct, purpose?: string): boolean {
  return live.status === 'CERTIFIED' && productSensitivity(pack, product).length === 0 && (purpose === undefined || rubrics.access.auto_approve_purposes.includes(purpose));
}

export function productBadge(pack: Pack, rubrics: Rubrics, product: DataProduct, live: LiveProduct, who: Principal, pending: Set<string>): AccessBadge {
  if (who.entitlements.includes(product.id)) return 'Granted';
  if (pending.has(product.id)) return 'Pending';
  return autoApprovable(pack, rubrics, product, live) ? 'Requestable' : 'Restricted';
}

export function productCard(pack: Pack, rubrics: Rubrics, product: DataProduct, state: CatalogState, who: Principal): ProductCard {
  const live = state.live.get(product.id) ?? liveFromPack(product);
  return {
    kind: 'product',
    id: product.id,
    name: product.name,
    domain: product.domain,
    description: product.description,
    status: live.status,
    version: live.version,
    stage: live.stage,
    quality: state.quality.get(product.id) ?? null,
    sensitivity: productSensitivity(pack, product),
    consumers: product.consumers,
    agents: pack.agents.filter((a) => a.products.some((b) => b.id === product.id)).map((a) => ({ id: a.id, name: a.name, hue: a.avatar.hue })),
    kpis: product.kpis.map((id) => ({ id, name: pack.kpis.find((k) => k.id === id)?.name ?? id })),
    patterns: [...new Set(product.output_ports.map((o) => o.kind))],
    owner: pack.personas.find((p) => p.id === product.owner)?.name ?? product.owner,
    access: productBadge(pack, rubrics, product, live, who, state.pendingProducts),
    freshnessMinutes: product.sla.freshness_minutes,
    degraded: state.degraded?.has(product.id) ?? false,
  };
}

export function agentCard(pack: Pack, agent: AgentManifest, who: Principal): AgentCard {
  const products = agent.products.map((b) => ({ id: b.id, name: pack.products.find((p) => p.id === b.id)?.name ?? b.id }));
  const granted = agent.products.every((b) => who.entitlements.includes(b.id));
  return {
    kind: 'agent',
    id: agent.id,
    name: agent.name,
    domain: agent.domain,
    capability: agent.capability,
    status: agent.status,
    hue: agent.avatar.hue,
    products,
    kpiCount: agent.kpi_coverage.length,
    costPerAnswer: agent.budgets.cost_per_answer_usd,
    evalGoldenMin: agent.eval.golden_min,
    access: granted ? 'Granted' : agent.products.some((b) => who.entitlements.includes(b.id)) ? 'Requestable' : 'Restricted',
  };
}

export interface CatalogFilters {
  q?: string;
  type?: 'product' | 'agent' | 'all';
  domain?: string;
  status?: string;
  tier?: string;
  kpi?: string;
  sensitivity?: string;
  pattern?: string;
  owner?: string;
  mine?: boolean;
  hasAgent?: boolean;
}

export function filterProducts(cards: ProductCard[], f: CatalogFilters): ProductCard[] {
  return cards.filter(
    (c) =>
      (!f.domain || c.domain === f.domain) &&
      (!f.status || c.status === f.status) &&
      (!f.tier || c.quality?.tier === f.tier) &&
      (!f.kpi || c.kpis.some((k) => k.id === f.kpi)) &&
      (!f.sensitivity || (f.sensitivity === 'none' ? c.sensitivity.length === 0 : c.sensitivity.includes(f.sensitivity as SensitiveClass))) &&
      (!f.pattern || c.patterns.includes(f.pattern)) &&
      (!f.owner || c.owner === f.owner) &&
      (!f.mine || c.access === 'Granted') &&
      (!f.hasAgent || c.agents.length > 0),
  );
}

export interface Facet {
  key: keyof CatalogFilters;
  values: { value: string; label: string; count: number }[];
}

export function productFacets(cards: ProductCard[]): Facet[] {
  const count = (key: keyof CatalogFilters, values: (c: ProductCard) => string[], label: (v: string) => string = (v) => v): Facet => {
    const m = new Map<string, number>();
    for (const c of cards) for (const v of new Set(values(c))) m.set(v, (m.get(v) ?? 0) + 1);
    return { key, values: [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([value, n]) => ({ value, label: label(value), count: n })) };
  };
  const kpiNames = new Map(cards.flatMap((c) => c.kpis.map((k) => [k.id, k.name] as const)));
  return [
    count('domain', (c) => [c.domain]),
    count('status', (c) => [c.status]),
    count('tier', (c) => (c.quality ? [c.quality.tier] : [])),
    count('kpi', (c) => c.kpis.map((k) => k.id), (v) => kpiNames.get(v) ?? v),
    count('sensitivity', (c) => (c.sensitivity.length ? c.sensitivity : ['none'])),
    count('pattern', (c) => c.patterns),
    count('owner', (c) => [c.owner]),
  ];
}
