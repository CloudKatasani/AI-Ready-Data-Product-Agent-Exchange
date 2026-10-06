'use client';

import { useActionState } from 'react';
import { copy } from '@/copy/en';

type Result = { ok: boolean; message: string };

export function ImportProfileForm({ action }: { action: (prev: Result | null, form: FormData) => Promise<Result> }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 text-sm" aria-label={copy.presenter.profile.import}>
      <label className="flex flex-col gap-1">
        {copy.presenter.profile.importFile}
        <input type="file" name="file" accept="application/json,.json" />
      </label>
      <button type="submit" disabled={pending} className="h-9 rounded-md border border-border px-3 font-medium">
        {copy.presenter.profile.import}
      </button>
      {state && (
        <p role="status" className={state.ok ? 'basis-full text-certified' : 'basis-full font-medium text-fail'}>
          {state.message}
        </p>
      )}
    </form>
  );
}
