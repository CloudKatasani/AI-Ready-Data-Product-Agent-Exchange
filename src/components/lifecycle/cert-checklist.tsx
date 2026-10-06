'use client';

import { CheckCircle2, CircleAlert, CircleX } from 'lucide-react';
import { copy } from '@/copy/en';
import type { CheckResult } from '@/lib/lifecycle/certification';
import { type ActionResult, ResultNote, useAction } from './use-action';

const ICON = { pass: CheckCircle2, warn: CircleAlert, fail: CircleX } as const;
const TONE = { pass: 'text-certified', warn: 'text-in-certification', fail: 'text-fail' } as const;

/** Stage 11: the eight certification checks with Fix actions (the cert demo's scripted fixes change real state). */
export function CertChecklist({ checks, applyFix, evaluate }: { checks: CheckResult[]; applyFix: (fixId: string) => Promise<ActionResult>; evaluate: () => Promise<ActionResult> }) {
  const a = useAction();
  return (
    <section aria-labelledby="cert-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-testid="cert-checklist">
      <div className="flex items-center gap-2">
        <h2 id="cert-h" className="font-semibold">
          {copy.studio.certification}
        </h2>
        <button type="button" disabled={a.pending} onClick={() => a.run(evaluate)} className="ml-auto h-8 rounded-md border border-border px-3 text-sm">
          {copy.studio.evaluate}
        </button>
      </div>
      <ol className="flex flex-col gap-2">
        {checks.map((c) => {
          const Icon = ICON[c.status];
          return (
            <li key={c.id} className="flex items-start gap-2 text-sm" data-check={c.id} data-status={c.status}>
              <Icon aria-label={copy.studio.status[c.status]} className={`mt-0.5 size-4 shrink-0 ${TONE[c.status]}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.n}. {c.label} <span className="text-xs font-normal">· {copy.studio.status[c.status]}</span>
                </p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
              {c.fix && c.status !== 'pass' && !c.fix.applied && (
                <button type="button" disabled={a.pending} onClick={() => a.run(() => applyFix(c.fix?.id ?? ''))} className="h-8 shrink-0 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground" data-testid={`fix-${c.fix.id}`} title={c.fix.label}>
                  {copy.studio.applyFix}: {c.fix.label}
                </button>
              )}
              {c.fix?.applied && <span className="text-xs text-muted-foreground">{copy.studio.fixApplied}</span>}
            </li>
          );
        })}
      </ol>
      <ResultNote result={a.result} />
    </section>
  );
}
