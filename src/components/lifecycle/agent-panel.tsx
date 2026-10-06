'use client';

import { Bot } from 'lucide-react';
import { useState } from 'react';
import { copy } from '@/copy/en';
import type { Workspace } from '@/lib/presenter/studio';
import { FieldValueView, fieldText, parseFieldText } from './field-value';
import { type ActionResult, ResultNote, useAction } from './use-action';

export interface AgentPanelProps {
  agent: Workspace['agent'];
  proposals: Workspace['proposals'];
  narrative: string | null;
  /** `${artifactType}.${fieldPath}` → field kind. */
  fieldKinds: Record<string, string>;
  run: () => Promise<ActionResult>;
  decide: (proposalId: string, outcome: 'ACCEPT' | 'EDIT' | 'REJECT', edited?: unknown) => Promise<ActionResult>;
  acceptAll: () => Promise<ActionResult>;
}

/** Lifecycle agent panel: run → narrative → proposals per field with Accept / Edit / Reject. */
export function AgentPanel({ agent, proposals, narrative, fieldKinds, run, decide, acceptAll }: AgentPanelProps) {
  const fieldKind = (t: string, p: string) => fieldKinds[`${t}.${p}`] ?? 'text';
  const a = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  if (!agent) return null;
  return (
    <section aria-labelledby="agent-h" className="flex flex-col gap-3 rounded-lg border border-agent/60 bg-surface p-4" data-testid="agent-panel">
      <div className="flex items-center gap-2">
        <Bot aria-hidden className="size-5 text-agent" />
        <h2 id="agent-h" className="font-semibold">
          {agent.name} {copy.studio.agentPanel.toLowerCase()}
        </h2>
        <button type="button" disabled={a.pending} onClick={() => a.run(run)} className="ml-auto h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="run-agent">
          {copy.studio.runAgent}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{agent.charter}</p>
      {narrative && <p className="rounded-md bg-muted p-2 text-sm" data-testid="agent-narrative">{narrative}</p>}
      <ResultNote result={a.result} />
      {proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.studio.noProposals}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2" data-testid="proposals">
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 rounded-md border border-border p-2 text-sm" data-proposal={p.id}>
                <p className="font-medium">
                  {p.artifactType} · {p.fieldPath}
                </p>
                {editing === p.id ? (
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="rounded-md border border-border bg-background p-2 font-mono text-xs" aria-label={`Edit ${p.fieldPath}`} />
                ) : (
                  <FieldValueView value={p.value} />
                )}
                <p className="text-xs text-muted-foreground">{p.rationale}</p>
                <div className="flex flex-wrap gap-2">
                  {editing === p.id ? (
                    <button type="button" disabled={a.pending} onClick={() => a.run(() => decide(p.id, 'EDIT', parseFieldText(fieldKind(p.artifactType, p.fieldPath), text)))} className="h-7 rounded-md bg-primary px-2 text-xs text-primary-foreground">
                      {copy.studio.save}
                    </button>
                  ) : (
                    <>
                      <button type="button" disabled={a.pending} onClick={() => a.run(() => decide(p.id, 'ACCEPT'))} className="h-7 rounded-md bg-primary px-2 text-xs text-primary-foreground" data-testid="accept-proposal">
                        {copy.studio.accept}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p.id);
                          setText(fieldText(fieldKind(p.artifactType, p.fieldPath), p.value));
                        }}
                        className="h-7 rounded-md border border-border px-2 text-xs"
                      >
                        {copy.studio.editAccept}
                      </button>
                      <button type="button" disabled={a.pending} onClick={() => a.run(() => decide(p.id, 'REJECT'))} className="h-7 rounded-md border border-border px-2 text-xs">
                        {copy.studio.reject}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" disabled={a.pending} onClick={() => a.run(acceptAll)} className="h-8 self-start rounded-md border border-primary px-3 text-sm" data-testid="accept-all">
            {copy.studio.acceptAll}
          </button>
        </>
      )}
    </section>
  );
}
