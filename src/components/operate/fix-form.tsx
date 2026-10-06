'use client';

import { useState } from 'react';
import { type ActionResult, ResultNote, useAction } from '@/components/lifecycle/use-action';
import { copy } from '@/copy/en';

const c = copy.operate.quality;

/** Steward fix: map a phrase users say onto a governed metric (written as a versioned synonym overlay). */
export function SynonymFixForm({ action, metrics, testId }: { action: (custom: { term: string; metric: string }) => Promise<ActionResult>; metrics: { name: string; label: string }[]; testId: string }) {
  const a = useAction();
  const [term, setTerm] = useState('');
  const [metric, setMetric] = useState(metrics[0]?.name ?? '');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        if (term.trim()) a.run(() => action({ term, metric }));
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        {c.term}
        <input value={term} onChange={(e) => setTerm(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {c.synonymsOf}
        <select value={metric} onChange={(e) => setMetric(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2">
          {metrics.map((m) => (
            <option key={m.name} value={m.name}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={a.pending || !term.trim()} className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:border-primary disabled:opacity-60">
        {c.applyCustom}
      </button>
      <div className="basis-full">
        <ResultNote result={a.result} />
      </div>
    </form>
  );
}
