import Link from 'next/link';
import { type GraphNode, LineageGraph } from '@/components/graph/lineage-graph';
import { copy } from '@/copy/en';
import { lineageAround } from '@/lib/packs/lineage';
import type { Pack } from '@/lib/packs/schema';

export function hrefFor(pack: string, id: string): string | undefined {
  if (id.startsWith('DP-')) return `/${pack}/marketplace/products/${id}`;
  if (id.startsWith('AG-')) return `/${pack}/marketplace/agents/${id}`;
  if (id.startsWith('SEMANTIC.')) return `/${pack}/semantic/${id.split('.')[1]}`;
  const [schema, obj] = id.split('.');
  return obj ? `/${pack}/explorer/${schema}/${obj}` : undefined;
}

export function LineagePanel({ pack, fqn }: { pack: Pack; fqn: string }) {
  const id = pack.manifest.id;
  const g = lineageAround(pack, fqn);
  const nodes: GraphNode[] = g.nodes.map((n) => ({ id: n.id, label: n.label, layer: n.layer, href: hrefFor(id, n.id), focus: n.id === fqn }));
  const up = g.edges.filter((e) => e.to === fqn).map((e) => e.from);
  const down = g.edges.filter((e) => e.from === fqn).map((e) => e.to);
  const list = (ids: string[]) => (
    <ul className="flex flex-col gap-1">
      {ids.map((x) => (
        <li key={x}>
          <Link className="inline-block min-h-[24px] py-0.5 font-mono text-primary underline" href={hrefFor(id, x) ?? '#'}>
            {x}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-4">
      <LineageGraph nodes={nodes} edges={g.edges} />
      <div className="grid grid-cols-2 gap-6 text-sm">
        <section>
          <h3 className="mb-2 font-semibold">{copy.explorer.upstream}</h3>
          {list(up)}
        </section>
        <section>
          <h3 className="mb-2 font-semibold">{copy.explorer.downstream}</h3>
          {list(down)}
        </section>
      </div>
    </div>
  );
}
