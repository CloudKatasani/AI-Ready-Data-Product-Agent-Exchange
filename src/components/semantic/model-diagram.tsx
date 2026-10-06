'use client';

import { useEffect, useId, useRef, useState } from 'react';

/** Logical model diagram (Mermaid erDiagram), rendered client-side; the source is kept as a text alternative. */
export function ModelDiagram({ source, label }: { source: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void import('mermaid').then(async ({ default: mermaid }) => {
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Calibri, Carlito, sans-serif' });
        const { svg } = await mermaid.render(`m${id}`, source);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, id]);
  return (
    <figure className="rounded-md border border-border bg-surface p-4">
      <div ref={ref} role="img" aria-label={label} data-testid="model-diagram" className="overflow-x-auto [&_svg]:mx-auto" />
      <figcaption className={failed ? '' : 'sr-only'}>
        <pre className="font-mono text-xs">{source}</pre>
      </figcaption>
    </figure>
  );
}
