'use client';

import { Bot, Pencil, User } from 'lucide-react';
import { useState } from 'react';
import { copy } from '@/copy/en';
import type { ArtifactDef } from '@/lib/lifecycle/artifacts/registry';
import type { ArtifactView } from '@/lib/presenter/studio';
import { FieldValueView, fieldText, parseFieldText } from './field-value';
import { type ActionResult, ResultNote, useAction } from './use-action';

export interface ArtifactEditorProps {
  def: ArtifactDef;
  artifact: ArtifactView;
  /** personaId → display name. */
  personaNames: Record<string, string>;
  save: (content: Record<string, unknown>, message: string) => Promise<ActionResult>;
}

/** One artifact: fields with provenance badges; edit commits a new content-hashed version. */
export function ArtifactEditor({ def, artifact, personaNames, save }: ArtifactEditorProps) {
  const personaName = (id: string | null) => (id ? (personaNames[id] ?? id) : '—');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const { pending, result, run } = useAction();
  const value = (path: string) => artifact.fields.find((f) => f.path === path);
  const begin = () => {
    setDraft(Object.fromEntries(def.fields.map((f) => [f.path, fieldText(f.kind, value(f.path)?.value)])));
    setEditing(true);
  };
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" aria-labelledby={`art-${def.type}`} data-artifact={def.type}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={`art-${def.type}`} className="font-semibold">
          {def.label}
        </h3>
        <span className="text-xs text-muted-foreground">
          {artifact.version ? `v${artifact.version} · ${artifact.hash?.slice(0, 10)} · ${personaName(artifact.committedBy)}` : copy.studio.notStarted}
        </span>
        {!editing && (
          <button type="button" onClick={begin} className="ml-auto inline-flex min-h-[24px] items-center gap-1 rounded-md border border-border px-2 text-sm" data-testid="edit-artifact">
            <Pencil aria-hidden className="size-3.5" />
            {copy.studio.edit}
          </button>
        )}
      </header>
      <p className="text-sm text-muted-foreground">{def.description}</p>
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const content = Object.fromEntries(def.fields.map((f) => [f.path, parseFieldText(f.kind, draft[f.path] ?? '')]));
            run(async () => {
              const r = await save(content, message);
              if (r.ok) setEditing(false);
              return r;
            });
          }}
        >
          {def.fields.map((f) => (
            <label key={f.path} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                {f.label}
                {f.required ? ' *' : ''}
              </span>
              {f.kind === 'select' ? (
                <select value={draft[f.path] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.path]: e.target.value }))} className="h-9 rounded-md border border-border bg-background px-2">
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.kind === 'text' || f.kind === 'number' ? (
                <input type={f.kind === 'number' ? 'number' : 'text'} value={draft[f.path] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.path]: e.target.value }))} className="h-9 rounded-md border border-border bg-background px-2" data-field={f.path} />
              ) : (
                <textarea value={draft[f.path] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.path]: e.target.value }))} rows={f.kind === 'table' ? 8 : 3} className="rounded-md border border-border bg-background p-2 font-mono text-xs" data-field={f.path} />
              )}
              {f.kind === 'list' && <span className="text-xs text-muted-foreground">One per line</span>}
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm">
            {copy.studio.commitMessage}
            <input value={message} onChange={(e) => setMessage(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2" data-testid="commit-message" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="save-artifact">
              {copy.studio.save}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-md border border-border px-3 text-sm">
              {copy.studio.cancel}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-[12rem_1fr]">
          {def.fields.map((f) => {
            const v = value(f.path);
            return (
              <div key={f.path} className="contents">
                <dt className="flex items-start gap-1 text-muted-foreground">
                  {f.label}
                  {v?.source === 'AGENT' ? (
                    <span title={`${copy.studio.agentAccepted} ${personaName(v.acceptedBy)}`} className="inline-flex items-center gap-0.5 rounded border border-agent px-1 text-[10px] text-foreground" data-provenance="AGENT">
                      <Bot aria-hidden className="size-3 text-agent" />
                      {v.agentId}
                    </span>
                  ) : v?.source === 'HUMAN' ? (
                    <span title={copy.studio.human} data-provenance="HUMAN" className="inline-flex items-center">
                      <User aria-label={copy.studio.human} className="size-3 text-human" />
                    </span>
                  ) : null}
                </dt>
                <dd className="min-w-0">
                  <FieldValueView value={v?.value} />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <ResultNote result={result} />
    </section>
  );
}
