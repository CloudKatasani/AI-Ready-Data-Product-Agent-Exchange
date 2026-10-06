'use client';

import { useState, useTransition } from 'react';

export interface ActionResult {
  ok: boolean;
  message?: string;
  details?: string[];
}

/** Runs a server action, keeps its last result for an inline status message. */
export function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));
  return { pending, result, run, clear: () => setResult(null) };
}

export function ResultNote({ result }: { result: ActionResult | null }) {
  if (!result?.message) return null;
  return (
    <div role="status" data-testid="action-result" data-ok={result.ok} className={`rounded-md border px-3 py-2 text-sm ${result.ok ? 'border-certified/50' : 'border-fail/60'}`}>
      <p>{result.message}</p>
      {result.details?.length ? (
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          {result.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
