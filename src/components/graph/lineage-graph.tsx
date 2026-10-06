'use client';

import '@xyflow/react/dist/style.css';
import { Background, Controls, type Edge, MarkerType, type Node, ReactFlow } from '@xyflow/react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

export interface GraphNode {
  id: string;
  label: string;
  layer: string;
  href?: string;
  focus?: boolean;
}

const LAYER_ORDER = ['bronze', 'silver', 'gold', 'semantic', 'product', 'agent'];
const LAYER_COLOUR: Record<string, string> = {
  bronze: 'var(--layer-bronze)',
  silver: 'var(--layer-silver)',
  gold: 'var(--layer-gold)',
  semantic: 'var(--layer-semantic)',
  product: 'var(--layer-product)',
  agent: 'var(--layer-agent)',
};

/** Layered lineage graph (Bronze → … → Agent). A link list beside it is the keyboard/table alternative. */
export function LineageGraph({ nodes, edges, height = 420 }: { nodes: GraphNode[]; edges: { from: string; to: string }[]; height?: number }) {
  const router = useRouter();
  const { rfNodes, rfEdges } = useMemo(() => {
    const byLayer = new Map<string, GraphNode[]>();
    for (const n of nodes) byLayer.set(n.layer, [...(byLayer.get(n.layer) ?? []), n]);
    const rfNodes: Node[] = [];
    for (const [layer, list] of byLayer) {
      const x = Math.max(0, LAYER_ORDER.indexOf(layer)) * 260;
      list.forEach((n, i) =>
        rfNodes.push({
          id: n.id,
          position: { x, y: i * 64 },
          data: { label: n.label },
          ariaLabel: `${n.layer}: ${n.label}`,
          style: {
            border: `2px solid ${LAYER_COLOUR[layer] ?? 'var(--border)'}`,
            background: 'var(--surface)',
            color: 'var(--surface-foreground)',
            fontSize: 12,
            width: 220,
            fontWeight: n.focus ? 700 : 400,
            boxShadow: n.focus ? `0 0 0 3px ${LAYER_COLOUR[layer] ?? 'var(--ring)'}` : undefined,
          },
        }),
      );
    }
    const rfEdges: Edge[] = edges.map((e) => ({ id: `${e.from}>${e.to}`, source: e.from, target: e.to, markerEnd: { type: MarkerType.ArrowClosed } }));
    return { rfNodes, rfEdges };
  }, [nodes, edges]);
  const hrefs = useMemo(() => new Map(nodes.map((n) => [n.id, n.href])), [nodes]);

  return (
    <div style={{ height }} className="rounded-md border border-border" data-testid="lineage-graph">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_e, n) => {
          const href = hrefs.get(n.id);
          if (href) router.push(href);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
