'use client';

import { useActionState } from 'react';
import { copy } from '@/copy/en';

type Result = { ok: boolean; message: string; details?: string[] };
const c = copy.admin.drafter;

/** Pack Drafter form (01 §M13, offline mode). */
export function DrafterForm({ action, sources }: { action: (prev: Result | null, form: FormData) => Promise<Result>; sources: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(action, null);
  const field = 'h-9 rounded-md border border-border bg-surface px-2';
  const input = (name: string, label: string, required = false, placeholder?: string) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input name={name} required={required} placeholder={placeholder} className={field} />
    </label>
  );
  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3" data-testid="drafter-form" aria-label={c.title}>
      <label className="flex flex-col gap-1 text-sm">
        {c.from}
        <select name="from" className={field}>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {input('id', c.id, true, 'water')}
      {input('code', c.code, true, 'WTR')}
      {input('name', c.name, true, 'Water utility')}
      {input('industry', c.industry)}
      {input('company', c.company, true)}
      {input('short', c.short, true)}
      {input('hq', c.hq)}
      {input('regions', c.regions, false, 'North, South, …')}
      <div className="flex items-end md:col-span-3">
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {pending ? c.working : c.submit}
        </button>
      </div>
      {state && (
        <div role="status" className={`md:col-span-3 text-sm ${state.ok ? 'text-certified' : 'font-medium text-fail'}`} data-testid="drafter-result" data-ok={state.ok}>
          <p>{state.message}</p>
          {state.details?.length ? (
            <ul className="list-disc pl-5 font-normal text-muted-foreground">
              {state.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </form>
  );
}
