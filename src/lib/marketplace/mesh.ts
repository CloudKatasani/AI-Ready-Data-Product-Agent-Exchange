/**
 * Mesh views (01 §M3): the data mesh links products that share upstream objects or semantic tables;
 * the agent mesh links agents that share KPIs or products. Blast radius = everything reachable
 * downstream of a node (products → agents → KPIs), computed by breadth-first search.
 */
import { productObjects } from '@/lib/lifecycle/quality';
import type { Pack } from '@/lib/packs/schema';

export interface MeshNode {
  id: string;
  kind: 'product' | 'agent' | 'kpi';
  label: string;
}

export interface MeshEdge {
  source: string;
  target: string;
  label: string;
}

export interface Mesh {
  nodes: MeshNode[];
  edges: MeshEdge[];
}

export function dataMesh(pack: Pack): Mesh {
  const nodes: MeshNode[] = pack.products.map((p) => ({ id: p.id, kind: 'product', label: p.name }));
  const edges: MeshEdge[] = [];
  const objs = new Map(pack.products.map((p) => [p.id, new Set(productObjects(pack, p))]));
  for (let i = 0; i < pack.products.length; i++) {
    for (let j = i + 1; j < pack.products.length; j++) {
      const a = pack.products[i];
      const b = pack.products[j];
      if (!a || !b) continue;
      const shared = [...(objs.get(a.id) ?? [])].filter((o) => objs.get(b.id)?.has(o));
      if (shared.length) edges.push({ source: a.id, target: b.id, label: shared.map((s) => s.split('.')[1]).join(', ') });
    }
  }
  return { nodes, edges };
}

export function agentMesh(pack: Pack): Mesh {
  const nodes: MeshNode[] = [...pack.agents.map((a) => ({ id: a.id, kind: 'agent' as const, label: a.name })), ...pack.products.map((p) => ({ id: p.id, kind: 'product' as const, label: p.name }))];
  const edges: MeshEdge[] = [];
  for (const a of pack.agents) for (const b of a.products) edges.push({ source: b.id, target: a.id, label: 'feeds' });
  for (let i = 0; i < pack.agents.length; i++) {
    for (let j = i + 1; j < pack.agents.length; j++) {
      const a = pack.agents[i];
      const b = pack.agents[j];
      if (!a || !b) continue;
      const shared = a.kpi_coverage.filter((c) => b.kpi_coverage.some((d) => d.kpi === c.kpi)).map((c) => c.kpi);
      if (shared.length) edges.push({ source: a.id, target: b.id, label: `${shared.length} shared KPI${shared.length > 1 ? 's' : ''}` });
    }
  }
  return { nodes, edges };
}

/** Downstream impact of a product, warehouse object or agent: products, agents and KPIs affected. */
export function blastRadius(pack: Pack, nodeId: string): { products: string[]; agents: string[]; kpis: string[] } {
  const products = new Set<string>();
  if (pack.products.some((p) => p.id === nodeId)) products.add(nodeId);
  else for (const p of pack.products) if (productObjects(pack, p).includes(nodeId)) products.add(p.id);
  const agents = new Set<string>(pack.agents.filter((a) => a.id === nodeId || a.products.some((b) => products.has(b.id))).map((a) => a.id));
  const kpis = new Set<string>();
  for (const p of pack.products.filter((x) => products.has(x.id))) for (const k of p.kpis) kpis.add(k);
  for (const a of pack.agents.filter((x) => agents.has(x.id))) for (const c of a.kpi_coverage) if (products.size === 0 || pack.kpis.find((k) => k.id === c.kpi)?.products.some((p) => products.has(p))) kpis.add(c.kpi);
  return { products: [...products].sort(), agents: [...agents].sort(), kpis: [...kpis].sort() };
}
