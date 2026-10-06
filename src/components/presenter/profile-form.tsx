'use client';

import { useActionState, useState } from 'react';
import { copy } from '@/copy/en';
import { accessibleAlternative, passesAA } from '@/lib/presenter/branding';

const c = copy.presenter.profile;
type SaveResult = { ok: boolean; message: string; suggestions?: { field: string; colour: string; suggestion: string }[] };

function ColourField({ name, label, initial }: { name: string; label: string; initial: string }) {
  const [v, setV] = useState(initial);
  const ok = /^#[0-9a-fA-F]{6}$/.test(v) && passesAA(v);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={`f-${name}`}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={`f-${name}`} type="color" value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000'} onChange={(e) => setV(e.target.value)} className="h-9 w-12 rounded border border-border" aria-describedby={`c-${name}`} />
        <input name={name} value={v} onChange={(e) => setV(e.target.value)} className="h-9 w-28 rounded-md border border-border bg-surface px-2 font-mono" aria-label={`${label} hex`} data-testid={`colour-${name}`} />
      </div>
      <p id={`c-${name}`} className={`text-xs ${ok ? 'text-certified' : 'text-fail'}`} data-contrast={ok ? 'pass' : 'fail'}>
        {ok ? c.contrastOk : c.contrastFail(accessibleAlternative(v))}
        {!ok && (
          <button type="button" onClick={() => setV(accessibleAlternative(v))} className="ml-2 underline">
            {accessibleAlternative(v)}
          </button>
        )}
      </p>
    </div>
  );
}

/** Profile setup (01 §M1): branding with live AA contrast check, terminology, story, agent mode, kiosk lock. */
export function ProfileForm({ action, packId, defaults, terms, stories, liveAvailable }: { action: (prev: SaveResult | null, form: FormData) => Promise<SaveResult>; packId: string; defaults: { name: string; companyName: string; productName: string; primary: string; accent: string }; terms: string[]; stories: { id: string; title: string; minutes: number }[]; liveAvailable: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  const field = 'h-9 rounded-md border border-border bg-surface px-2';
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4" data-testid="profile-form" aria-label={c.setup}>
      <input type="hidden" name="packId" value={packId} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          {c.name}
          <input name="name" defaultValue={defaults.name} required maxLength={80} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {c.company}
          <input name="companyName" defaultValue={defaults.companyName} required maxLength={80} className={field} data-testid="profile-company" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {c.productName}
          <input name="productName" defaultValue={defaults.productName} required maxLength={80} className={field} />
        </label>
      </div>
      <div className="flex flex-wrap gap-6">
        <ColourField name="primary" label={c.primary} initial={defaults.primary} />
        <ColourField name="accent" label={c.accent} initial={defaults.accent} />
        <label className="flex flex-col gap-1 text-sm">
          {c.logo}
          <input type="file" name="logo" accept="image/png,image/svg+xml" className="text-sm" />
        </label>
      </div>
      {terms.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{c.terms}</legend>
          <div className="grid gap-2 md:grid-cols-3">
            {terms.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <span className="w-32 truncate" title={t}>
                  {t}
                </span>
                <span aria-hidden>→</span>
                <input name={`term:${t}`} className={`${field} flex-1`} aria-label={`${t} →`} data-term={t} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {c.story}
          <select name="storyId" className={field} defaultValue="" data-testid="profile-story">
            <option value="">{copy.presenter.freeRoam}</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.minutes}′)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {c.agentMode}
          <select name="agentMode" className={field} defaultValue="scripted">
            <option value="scripted">Scripted</option>
            <option value="auto">Auto</option>
            <option value="live" disabled={!liveAvailable} title={liveAvailable ? undefined : c.liveDisabled}>
              Live
            </option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="locked" />
          {c.lock}
        </label>
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" data-testid="profile-save">
          {c.save}
        </button>
      </div>
      {state && (
        <p role="status" className={state.ok ? 'text-sm text-certified' : 'text-sm font-medium text-fail'} data-testid="profile-result" data-ok={state.ok}>
          {state.message}
        </p>
      )}
    </form>
  );
}
