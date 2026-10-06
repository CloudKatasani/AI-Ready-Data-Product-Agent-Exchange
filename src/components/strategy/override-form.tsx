'use client';

import { useState } from 'react';
import { type ActionResult, ResultNote, useAction } from '@/components/lifecycle/use-action';
import { copy } from '@/copy/en';

const c = copy.strategy.portfolio;

/** A human override of an advisory score — the reason is mandatory and recorded. */
export function OverrideForm({ action, current, testId }: { action: (input: { score: string; reason: string }) => Promise<ActionResult>; current: number; testId: string }) {
  const a = useAction();
  const [score, setScore] = useState(String(current));
  const [reason, setReason] = useState('');
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs underline">{c.override}</summary>
      <form
        className="mt-2 flex flex-wrap items-end gap-2"
        data-testid={testId}
        onSubmit={(e) => {
          e.preventDefault();
          a.run(() => action({ score, reason }));
        }}
      >
        <label className="flex flex-col gap-1">
          {c.overrideScore}
          <input type="number" step="0.01" min={0} value={score} onChange={(e) => setScore(e.target.value)} className="h-8 w-24 rounded-md border border-border bg-surface px-2" />
        </label>
        <label className="flex flex-col gap-1">
          {c.reason}
          <input value={reason} onChange={(e) => setReason(e.target.value)} required className="h-8 w-56 rounded-md border border-border bg-surface px-2" />
        </label>
        <button type="submit" disabled={a.pending || !reason.trim()} className="h-8 rounded-md border border-border px-3 font-medium disabled:opacity-60">
          {c.override}
        </button>
        <div className="basis-full">
          <ResultNote result={a.result} />
        </div>
      </form>
    </details>
  );
}
