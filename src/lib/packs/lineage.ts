import type { Layer, Pack } from './schema';

export interface LineageNode {
  id: string;
  label: string;
  layer: Layer;
  kind: 'object' | 'semantic' | 'product' | 'agent';
}

export interface LineageEdge {
  from: string;
  to: string;
}

const LAYER_OF_SCHEMA: Record<string, Layer> = { RAW_BRONZE: 'bronze', CURATED_SILVER: 'silver', CONFORMED_GOLD: 'gold' };

/** Estate lineage from pack metadata: Bronze → Silver → Gold → semantic views → products → agents. */
export function estateLineage(pack: Pack): { nodes: LineageNode[]; edges: LineageEdge[] } {
  const nodes = new Map<string, LineageNode>();
  const edges: LineageEdge[] = [];
  const add = (n: LineageNode) => nodes.set(n.id, nodes.get(n.id) ?? n);
  for (const s of pack.sources) add({ id: `RAW_BRONZE.${s.name}`, label: s.name, layer: 'bronze', kind: 'object' });
  for (const o of pack.objects) {
    const [schema = '', name = ''] = o.fqn.split('.');
    add({ id: o.fqn, label: name, layer: LAYER_OF_SCHEMA[schema] ?? 'gold', kind: 'object' });
    for (const u of o.upstream) edges.push({ from: u, to: o.fqn });
  }
  for (const v of pack.semantic) {
    const id = `SEMANTIC.${v.name}`;
    add({ id, label: v.name, layer: 'semantic', kind: 'semantic' });
    for (const t of v.tables) edges.push({ from: t.fqn, to: id });
  }
  for (const p of pack.products) {
    add({ id: p.id, label: `${p.id} ${p.name}`, layer: 'product', kind: 'product' });
    if (p.semantic_view) edges.push({ from: `SEMANTIC.${p.semantic_view}`, to: p.id });
    else for (const u of p.upstream) edges.push({ from: u, to: p.id });
    // The product's SQL output port (a DATA_PRODUCTS view) is exposed by the product.
    for (const port of p.output_ports.filter((o) => o.kind === 'sql')) {
      add({ id: port.ref, label: port.ref.split('.')[1] ?? port.ref, layer: 'product', kind: 'object' });
      edges.push({ from: p.id, to: port.ref });
    }
  }
  for (const a of pack.agents) {
    add({ id: a.id, label: `${a.id} ${a.name}`, layer: 'agent', kind: 'agent' });
    for (const p of a.products) edges.push({ from: p.id, to: a.id });
  }
  const seen = new Set<string>();
  const unique = edges.filter((e) => nodes.has(e.from) && nodes.has(e.to) && !seen.has(`${e.from}>${e.to}`) && seen.add(`${e.from}>${e.to}`));
  return { nodes: [...nodes.values()], edges: unique };
}

/** The connected upstream and downstream neighbourhood of one node. */
export function lineageAround(pack: Pack, id: string, depth = 6): { nodes: LineageNode[]; edges: LineageEdge[] } {
  const all = estateLineage(pack);
  const keep = new Set([id]);
  const walk = (dir: 'up' | 'down') => {
    let frontier = [id];
    for (let i = 0; i < depth && frontier.length; i++) {
      const next: string[] = [];
      for (const e of all.edges) {
        const [a, b] = dir === 'up' ? [e.to, e.from] : [e.from, e.to];
        if (frontier.includes(a) && !keep.has(b)) {
          keep.add(b);
          next.push(b);
        }
      }
      frontier = next;
    }
  };
  walk('up');
  walk('down');
  return { nodes: all.nodes.filter((n) => keep.has(n.id)), edges: all.edges.filter((e) => keep.has(e.from) && keep.has(e.to)) };
}

/** The data product whose SQL output port is `fqn` (a DATA_PRODUCTS view), if any. */
export function productForObject(pack: Pack, fqn: string): Pack['products'][number] | undefined {
  return pack.products.find((p) => p.output_ports.some((o) => o.kind === 'sql' && o.ref === fqn));
}

/** DATA_PRODUCTS.DP_REGISTRY lists every product: its lineage is the registry and the products it lists. */
export const REGISTRY_FQN = 'DATA_PRODUCTS.DP_REGISTRY';
export function registryLineage(pack: Pack): { nodes: LineageNode[]; edges: LineageEdge[] } {
  const nodes: LineageNode[] = [{ id: REGISTRY_FQN, label: 'DP_REGISTRY', layer: 'product', kind: 'object' }, ...pack.products.map((p) => ({ id: p.id, label: `${p.id} ${p.name}`, layer: 'product' as const, kind: 'product' as const }))];
  return { nodes, edges: pack.products.map((p) => ({ from: p.id, to: REGISTRY_FQN })) };
}
