'use client';

import { CheckCircle2, CircleSlash } from 'lucide-react';
import { useState } from 'react';
import { copy } from '@/copy/en';
import type { Criterion } from '@/lib/lifecycle/criteria';
import type { GateView } from '@/lib/presenter/studio';
import { cn } from '@/lib/utils';
import { type ActionResult, ResultNote, useAction } from './use-action';

export interface GatePanelProps {
  gate: GateView | null;
  criteria: Criterion[];
  canSubmit: boolean;
  myRoles: string[];
  submit: () => Promise<ActionResult>;
  decide: (outcome: 'APPROVE' | 'REJECT' | 'VETO', rationale: string) => Promise<ActionResult>;
}

/** Exit criteria + gate: roles, quorum meter, evidence, decisions; Submit / Approve / Reject / Veto. */
export function GatePanel({ gate, criteria, canSubmit, myRoles, submit, decide }: GatePanelProps) {
  const a = useAction();
  const [why, setWhy] = useState('');
  const met = criteria.every((c) => c.ok);
  const eligible = gate ? gate.roles.some((r) => myRoles.includes(r)) : false;
  const since = gate?.decisions ?? [];
  const approvals = new Set(since.filter((d) => d.outcome === 'APPROVE').map((d) => d.personaId)).size;
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="crit-h" className="rounded-lg border border-border bg-surface p-4" data-testid="exit-criteria">
        <h2 id="crit-h" className="mb-2 font-semibold">
          {copy.studio.criteria}
        </h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {criteria.map((c) => (
            <li key={c.id} className="flex gap-2" data-criterion={c.id} data-ok={c.ok}>
              {c.ok ? <CheckCircle2 aria-label="met" className="mt-0.5 size-4 shrink-0 text-certified" /> : <CircleSlash aria-label="not met" className="mt-0.5 size-4 shrink-0 text-fail" />}
              <span>
                {c.label}
                <span className="block text-xs text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="gate-h" className="rounded-lg border border-border bg-surface p-4" data-testid="gate-panel" data-gate-state={gate?.state ?? 'NONE'}>
        <h2 id="gate-h" className="mb-2 flex items-center gap-2 font-semibold">
          {copy.studio.gate}
          {gate && <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">{copy.studio.gateStates[gate.state as keyof typeof copy.studio.gateStates] ?? gate.state}</span>}
        </h2>
        {!gate ? (
          <p className="text-sm text-muted-foreground">{copy.studio.noGate}</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            {gate.staleReason && <p className="rounded-md border border-degraded px-2 py-1">{gate.staleReason}</p>}
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
              <dt className="text-muted-foreground">{copy.studio.requiredRoles}</dt>
              <dd>{gate.roles.join(', ')}</dd>
              <dt className="text-muted-foreground">{copy.studio.quorum}</dt>
              <dd>
                <span className="inline-flex gap-1" aria-hidden>
                  {Array.from({ length: gate.quorum }, (_, i) => (
                    <span key={i} className={cn('size-3 rounded-full border border-border', i < approvals && 'bg-certified')} />
                  ))}
                </span>{' '}
                <span data-testid="quorum">
                  {approvals}/{gate.quorum}
                </span>
              </dd>
              {gate.veto.length > 0 && (
                <>
                  <dt className="text-muted-foreground">{copy.studio.veto}</dt>
                  <dd>{gate.veto.join(', ')}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{copy.studio.evidence}</dt>
              <dd className="font-mono text-xs">{gate.evidence.slice(-4).map((e) => `${e.type} ${e.hash.slice(0, 8)}`).join(' · ') || '—'}</dd>
            </dl>
            {since.length > 0 && (
              <ul className="flex flex-col gap-1" aria-label={copy.studio.decisions}>
                {since.slice(-6).map((d, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{d.name}</span> ({d.role}) — {d.outcome.toLowerCase()}: {d.rationale}
                  </li>
                ))}
              </ul>
            )}
            {['PENDING', 'REJECTED', 'STALE'].includes(gate.state) && canSubmit && (
              <button type="button" disabled={a.pending || !met} onClick={() => a.run(submit)} className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground disabled:opacity-60" data-testid="submit-stage" title={met ? undefined : 'Exit criteria are not met yet'}>
                {copy.studio.submit}
              </button>
            )}
            {gate.state === 'IN_REVIEW' && eligible && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  {copy.studio.rationale}
                  <input value={why} onChange={(e) => setWhy(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2" data-testid="gate-rationale" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={a.pending} onClick={() => a.run(() => decide('APPROVE', why))} className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground" data-testid="approve-gate">
                    {copy.studio.approve}
                  </button>
                  <button type="button" disabled={a.pending} onClick={() => a.run(() => decide('REJECT', why))} className="h-8 rounded-md border border-border px-3">
                    {copy.studio.rejectGate}
                  </button>
                  {gate.veto.some((r) => myRoles.includes(r)) && (
                    <button type="button" disabled={a.pending} onClick={() => a.run(() => decide('VETO', why))} className="h-8 rounded-md border border-fail px-3">
                      {copy.studio.vetoGate}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <ResultNote result={a.result} />
      </section>
    </div>
  );
}
