'use client';

import { type ActionResult, ResultNote, useAction } from '@/components/lifecycle/use-action';

/** A button that runs a bound server action and shows its result inline. */
export function ActionButton({ action, label, testId, tone = 'outline', showResult = true }: { action: () => Promise<ActionResult>; label: string; testId: string; tone?: 'primary' | 'outline' | 'danger'; showResult?: boolean }) {
  const a = useAction();
  const cls = tone === 'primary' ? 'bg-primary text-primary-foreground' : tone === 'danger' ? 'border border-fail/60 text-foreground hover:bg-fail/10' : 'border border-border hover:border-primary';
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={a.pending} onClick={() => a.run(action)} className={`h-9 self-start rounded-md px-3 text-sm font-medium disabled:opacity-60 ${cls}`} data-testid={testId} aria-busy={a.pending}>
        {label}
      </button>
      {showResult && <ResultNote result={a.result} />}
    </div>
  );
}
