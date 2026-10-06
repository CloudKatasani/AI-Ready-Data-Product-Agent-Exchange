'use client';

import { useCallback, useEffect, useState } from 'react';

/** Steps a highlight through the flow path (Bronze → … → Agent). Honours prefers-reduced-motion: no auto-advance. */
export function FlowReplay({ steps, label, replayLabel, autoplay = false }: { steps: { layer: string; id: string; label: string }[]; label: string; replayLabel: string; autoplay?: boolean }) {
  const [at, setAt] = useState(steps.length - 1);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    if (at >= steps.length - 1) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setAt((n) => n + 1), 650);
    return () => clearTimeout(t);
  }, [running, at, steps.length]);
  const replay = useCallback(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAt(reduce ? steps.length - 1 : 0);
    setRunning(!reduce);
  }, [steps.length]);
  useEffect(() => {
    if (autoplay) replay();
  }, [autoplay, replay]);
  return (
    <section aria-label={label} className="flex flex-col gap-2" data-testid="flow-replay" data-at={at}>
      <div className="flex items-center gap-3">
        <h2 className="font-semibold">{label}</h2>
        <button type="button" onClick={replay} className="h-8 rounded-md border border-border px-3 text-sm" data-testid="flow-replay-run">
          {replayLabel}
        </button>
      </div>
      <ol className="flex flex-wrap items-center gap-1 text-xs" aria-live="polite">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-1" data-step={s.layer} aria-current={i === at ? 'step' : undefined}>
            <span className={`rounded-md border px-2 py-1 transition-colors ${i <= at ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground'} ${i === at ? 'font-semibold' : ''}`}>
              <span className="block uppercase tracking-wide text-[10px] text-muted-foreground">{s.layer}</span>
              {s.label}
            </span>
            {i < steps.length - 1 && <span aria-hidden>→</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
