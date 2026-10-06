import Link from 'next/link';
import { type GraphNode, LineageGraph } from '@/components/graph/lineage-graph';
import { lineageAround } from '@/lib/packs/lineage';
import type { Pack } from '@/lib/packs/schema';

function hrefFor(pack: string, id: string): string | undefined {
  if (id.startsWith('DP-')) return `/${pack}/marketplace/products/${id}`;
  if (id.startsWith('AG-')) return `/${pack}/marketplace/agents/${id}`;
  if (id.startsWith('SEMANTIC.')) return `/${pack}/semantic/${id.split('.')[1]}`;
  const [schema, obj] = id.split('.');
  return obj ? `/${pack}/explorer/${schema}/${obj}` : undefined;
}

/** Bronze → … → Agent lineage around a product or agent, with a link list as the keyboard alternative. */
export function LineagePanelForId({ pack, id }: { pack: Pack; id: string }) {
  const g = lineageAround(pack, id);
  const nodes: GraphNode[] = g.nodes.map((n) => ({ id: n.id, label: n.label, layer: n.layer, href: hrefFor(pack.manifest.id, n.id), focus: n.id === id }));
  return (
    <div className="flex flex-col gap-3">
      <LineageGraph nodes={nodes} edges={g.edges} height={480} />
      <ul className="flex flex-wrap gap-2 text-xs">
        {g.nodes.map((n) => (
          <li key={n.id}>
            <Link href={hrefFor(pack.manifest.id, n.id) ?? '#'} className="inline-block min-h-[24px] rounded border border-border px-2 py-0.5 font-mono hover:border-primary">
              {n.id}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
