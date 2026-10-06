'use client';

import '@xyflow/react/dist/style.css';
import { Background, Controls, type Edge, type Node, ReactFlow } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { copy } from '@/copy/en';

export interface MeshProps {
  nodes: { id: string; kind: 'product' | 'agent' | 'kpi'; label: string }[];
  edges: { source: string; target: string; label: string }[];
  radius: Record<string, string[]>;
  label: string;
  /** Display names for every id that can appear in a blast radius. */
  names: Record<string, string>;
}

/** Mesh graph; clicking a node highlights its blast radius. The list below it is the keyboard alternative. */
export function MeshGraph({ nodes, edges, radius, label, names }: MeshProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const hit = new Set(selected ? [selected, ...(radius[selected] ?? [])] : []);
  const rf = useMemo(() => {
    const products = nodes.filter((n) => n.kind === 'product');
    const agents = nodes.filter((n) => n.kind !== 'product');
    const pos = new Map<string, { x: number; y: number }>();
    products.forEach((n, i) => pos.set(n.id, { x: (i % 4) * 230, y: Math.floor(i / 4) * 110 }));
    agents.forEach((n, i) => pos.set(n.id, { x: i * 230, y: (Math.ceil(products.length / 4) + 0.8) * 110 }));
    return { pos };
  }, [nodes]);
  const rfNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    position: rf.pos.get(n.id) ?? { x: 0, y: 0 },
    data: { label: n.label },
    ariaLabel: `${n.kind}: ${n.label}`,
    style: {
      width: 200,
      fontSize: 12,
      background: 'var(--surface)',
      color: 'var(--surface-foreground)',
      border: `2px solid ${n.kind === 'agent' ? 'var(--color-agent)' : 'var(--layer-product)'}`,
      opacity: selected && !hit.has(n.id) ? 0.3 : 1,
      boxShadow: selected === n.id ? '0 0 0 3px var(--color-ring)' : undefined,
    },
  }));
  const rfEdges: Edge[] = edges.map((e) => ({ id: `${e.source}-${e.target}`, source: e.source, target: e.target, label: e.label, style: { opacity: selected && !(hit.has(e.source) && hit.has(e.target)) ? 0.15 : 1 } }));
  return (
    <div className="flex flex-col gap-3">
      <div style={{ height: 460 }} className="rounded-md border border-border" data-testid="mesh-graph" aria-label={label}>
        <ReactFlow nodes={rfNodes} edges={rfEdges} fitView nodesDraggable={false} onNodeClick={(_, n) => setSelected((s) => (s === n.id ? null : n.id))} proOptions={{ hideAttribution: true }}>
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={copy.marketplace.mesh.select}>
        {nodes.map((n) => (
          <button key={n.id} type="button" aria-pressed={selected === n.id} onClick={() => setSelected((s) => (s === n.id ? null : n.id))} className="min-h-[24px] rounded-full border border-border px-2 py-0.5 text-xs aria-pressed:border-primary aria-pressed:text-primary" data-node={n.id}>
            {n.label}
          </button>
        ))}
      </div>
      <p className="text-sm" role="status" data-testid="blast-radius">
        {selected ? (
          <>
            <span className="font-semibold">{copy.marketplace.mesh.blast}:</span> {(radius[selected] ?? []).map((id) => names[id] ?? id).join(', ') || '—'}
          </>
        ) : (
          copy.marketplace.mesh.select
        )}
      </p>
    </div>
  );
}
