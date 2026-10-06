'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { copy } from '@/copy/en';
import type { DuplicateCandidate } from '@/lib/packs/similarity';

export interface IntakeValues {
  title: string;
  decision: string;
  decider: string;
  cadence: string;
  workaround: string;
  questions: string[];
  stakes: string;
  freshness: string;
}

export interface IntakeWizardProps {
  packId: string;
  check: (i: Pick<IntakeValues, 'title' | 'decision' | 'questions'>) => Promise<DuplicateCandidate[]>;
  submit: (i: IntakeValues) => Promise<{ ok: boolean; id?: string; reference?: string; duplicates?: DuplicateCandidate[]; error?: string }>;
}

const input = 'h-9 rounded-md border border-border bg-background px-2';
const area = 'rounded-md border border-border bg-background p-2';

/** Five-step intake (01 §M5, ported ADPM) with duplicate detection before submit (AC5.1). */
export function IntakeWizard({ packId, check, submit }: IntakeWizardProps) {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<IntakeValues>({ title: '', decision: '', decider: '', cadence: '', workaround: '', questions: ['', '', ''], stakes: '', freshness: '' });
  const [dups, setDups] = useState<DuplicateCandidate[]>([]);
  const [done, setDone] = useState<{ id?: string; reference?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof IntakeValues) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const next = () => {
    if (step === 2) start(async () => setDups(await check({ title: v.title, decision: v.decision, questions: v.questions })));
    setStep((s) => Math.min(4, s + 1));
  };
  const href = (d: DuplicateCandidate) => (d.kind === 'product' ? `/${packId}/marketplace/products/${d.id}` : `/${packId}/ask/${d.id}`);
  if (done?.reference) {
    return (
      <div role="status" className="rounded-lg border border-certified p-4" data-testid="intake-done">
        <p className="font-semibold">
          {copy.intake.submitted}: {done.reference}
        </p>
        <Link href={`/${packId}/request/${done.id}`} className="text-primary underline">
          {done.reference}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4" data-testid="intake-wizard">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {copy.intake.steps.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={`rounded-full border px-3 py-1 ${i === step ? 'border-primary font-semibold' : 'border-border text-muted-foreground'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <form
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 4) next();
          else start(async () => setDone(await submit(v)));
        }}
      >
        {step === 0 && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              {copy.intake.titleLabel}
              <input className={input} value={v.title} onChange={set('title')} data-testid="intake-title" required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {copy.intake.decision}
              <textarea className={area} rows={3} value={v.decision} onChange={set('decision')} data-testid="intake-decision" required />
            </label>
          </>
        )}
        {step === 1 && (
          <>
            {(['decider', 'cadence', 'workaround'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-sm">
                {copy.intake[k]}
                <input className={input} value={v[k]} onChange={set(k)} data-testid={`intake-${k}`} />
              </label>
            ))}
          </>
        )}
        {step === 2 && (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1">{copy.intake.questions}</legend>
            {v.questions.map((q, i) => (
              <input key={i} aria-label={`Question ${i + 1}`} className={input} value={q} onChange={(e) => setV((x) => ({ ...x, questions: x.questions.map((y, j) => (j === i ? e.target.value : y)) }))} data-testid={`intake-q${i}`} />
            ))}
            <button type="button" onClick={() => setV((x) => ({ ...x, questions: [...x.questions, ''] }))} className="self-start text-primary underline">
              {copy.intake.addQuestion}
            </button>
          </fieldset>
        )}
        {step === 3 && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              {copy.intake.stakes}
              <textarea className={area} rows={2} value={v.stakes} onChange={set('stakes')} data-testid="intake-stakes" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {copy.intake.freshness}
              <input className={input} value={v.freshness} onChange={set('freshness')} data-testid="intake-freshness" />
            </label>
          </>
        )}
        {step === 4 && (
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">{copy.intake.titleLabel}</dt>
            <dd>{v.title}</dd>
            <dt className="text-muted-foreground">{copy.intake.decision}</dt>
            <dd>{v.decision}</dd>
            <dt className="text-muted-foreground">{copy.intake.decider}</dt>
            <dd>
              {v.decider} · {v.cadence}
            </dd>
            <dt className="text-muted-foreground">{copy.intake.questions}</dt>
            <dd>{v.questions.filter(Boolean).join(' · ')}</dd>
          </dl>
        )}
        {dups.length > 0 && step >= 3 && (
          <div role="status" className="rounded-md border border-in-certification p-3 text-sm" data-testid="intake-duplicates">
            <p className="font-medium">{copy.intake.duplicates}</p>
            <ul className="list-disc pl-5">
              {dups.map((d) => (
                <li key={`${d.kind}-${d.id}`} data-duplicate={d.id}>
                  <Link className="underline" href={href(d)}>
                    {d.name}
                  </Link>{' '}
                  · {Math.round(d.similarity * 100)}% {copy.intake.similarity}
                </li>
              ))}
            </ul>
          </div>
        )}
        {done?.error && (
          <p role="alert" className="text-sm text-fail">
            {done.error}
          </p>
        )}
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="h-9 rounded-md border border-border px-3 text-sm">
              {copy.intake.back}
            </button>
          )}
          <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" data-testid="intake-next">
            {step < 4 ? copy.intake.next : copy.intake.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
