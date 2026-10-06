'use client';

import { CheckCircle2, CircleX } from 'lucide-react';
import { useState, useTransition } from 'react';
import { copy } from '@/copy/en';

const f = copy.factory;

export interface SuiteRow {
  suite: string;
  score: number | null;
  n: number;
  threshold: number;
  passed: boolean;
}

export interface Result {
  ok: boolean;
  message: string;
}

function Note({ r }: { r: Result | null }) {
  if (!r) return null;
  return (
    <p role="status" data-testid="factory-result" data-ok={r.ok} className={`rounded-md border px-3 py-2 text-sm ${r.ok ? 'border-certified/60' : 'border-fail/60'}`}>
      {r.message}
    </p>
  );
}

export function EvalPanel({ suites, failing, run }: { suites: SuiteRow[] | null; failing: { suite: string; question: string; reason: string | null }[]; run: () => Promise<Result> }) {
  const [r, setR] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col gap-3" data-testid="eval-panel">
      <button type="button" disabled={pending} onClick={() => start(async () => setR(await run()))} className="h-9 self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="run-eval">
        {f.runEval}
      </button>
      <Note r={r} />
      {suites && (
        <table className="w-full max-w-xl text-sm" data-testid="eval-scorecard">
          <thead>
            <tr className="text-left">
              <th scope="col">{f.suite}</th>
              <th scope="col">{f.score}</th>
              <th scope="col">{f.threshold}</th>
            </tr>
          </thead>
          <tbody>
            {suites.map((s) => (
              <tr key={s.suite} className="border-t border-border" data-suite={s.suite} data-passed={s.passed}>
                <td className="py-1 capitalize">{s.suite}</td>
                <td className="py-1">
                  {s.score === null ? '—' : `${Math.round(s.score * 100)}%`} <span className="text-xs text-muted-foreground">({s.n} {f.cases})</span>
                </td>
                <td className="py-1">≥ {Math.round(s.threshold * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {failing.length > 0 && (
        <details className="text-sm">
          <summary>
            {f.failing} ({failing.length})
          </summary>
          <ul className="list-disc pl-5">
            {failing.map((c, i) => (
              <li key={i}>
                [{c.suite}] {c.question} — {c.reason ?? 'failed'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function GatePanel({ checks, run }: { checks: { n: number; label: string; passed: boolean; detail: string; fix: string }[] | null; run: () => Promise<Result> }) {
  const [r, setR] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col gap-3" data-testid="publish-gate">
      <button type="button" disabled={pending} onClick={() => start(async () => setR(await run()))} className="h-9 self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="run-gate">
        {f.runGate}
      </button>
      <Note r={r} />
      {checks && (
        <ol className="flex flex-col gap-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.n} className="flex gap-2" data-gate-check={c.n} data-passed={c.passed}>
              {c.passed ? <CheckCircle2 aria-label="pass" className="mt-0.5 size-4 shrink-0 text-certified" /> : <CircleX aria-label="fail" className="mt-0.5 size-4 shrink-0 text-fail" />}
              <span>
                {c.n}. {c.label} <span className="block text-xs text-muted-foreground">{c.detail}{c.passed ? '' : ` — ${c.fix}`}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ReleasePanel({ status, act }: { status: string; act: (step: 'pilot' | 'canary' | 'production' | 'rollback', rationale: string) => Promise<Result> }) {
  const [r, setR] = useState<Result | null>(null);
  const [why, setWhy] = useState('');
  const [pending, start] = useTransition();
  const btn = (step: 'pilot' | 'canary' | 'production' | 'rollback', label: string, testid: string) => (
    <button type="button" disabled={pending} onClick={() => start(async () => setR(await act(step, why)))} className="h-9 rounded-md border border-primary px-3 text-sm" data-testid={testid}>
      {label}
    </button>
  );
  return (
    <section className="flex flex-col gap-3" data-testid="release-panel" data-status={status}>
      <p className="text-sm">
        {f.status}: <span className="font-semibold">{status.toLowerCase()}</span>
      </p>
      <label className="flex max-w-md flex-col gap-1 text-sm">
        {f.rationale}
        <input value={why} onChange={(e) => setWhy(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2" data-testid="release-rationale" />
      </label>
      <div className="flex flex-wrap gap-2">
        {status === 'DRAFT' && btn('pilot', f.approvePilot, 'release-pilot')}
        {status === 'PILOT' && btn('canary', f.promoteCanary, 'release-canary')}
        {status === 'CANARY' && btn('production', f.promoteProduction, 'release-production')}
        {(status === 'CANARY' || status === 'PRODUCTION') && btn('rollback', f.rollback, 'release-rollback')}
      </div>
      <Note r={r} />
    </section>
  );
}
