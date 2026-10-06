'use client';

import { CheckCircle2, CircleSlash, MinusCircle } from 'lucide-react';
import { useState } from 'react';
import { PolicyChips } from '@/components/governance/policy-chips';
import { CodeBlock } from '@/components/ui/code-block';
import { copy } from '@/copy/en';
import type { AgentAnswer, TraceStep } from '@/lib/agents/types';
import { cn } from '@/lib/utils';
import { CitationChips } from './citations';

const TABS = ['trace', 'sql', 'sources', 'policy'] as const;
type Tab = (typeof TABS)[number];
const STATUS_ICON = { ok: CheckCircle2, skipped: MinusCircle, blocked: CircleSlash } as const;
const STATUS_TONE = { ok: 'text-certified', skipped: 'text-muted-foreground', blocked: 'text-fail' } as const;

export function TraceList({ steps, live }: { steps: TraceStep[]; live?: boolean }) {
  return (
    <ol className="flex flex-col gap-2" aria-label={copy.ask.howAnswered} data-testid="trace" aria-live={live ? 'polite' : undefined}>
      {steps.map((s, i) => {
        const Icon = STATUS_ICON[s.status];
        return (
          <li key={`${s.id}-${i}`} data-step={s.id} data-status={s.status} className="flex gap-2 text-sm">
            <Icon aria-label={copy.ask.status[s.status]} className={cn('mt-0.5 size-4 shrink-0', STATUS_TONE[s.status])} />
            <div className="min-w-0">
              <p className="font-medium">
                {i + 1}. {s.label} <span className="font-normal text-muted-foreground">· {s.layer} · {s.ms} ms</span>
              </p>
              <p className="break-words text-muted-foreground">{s.detail}</p>
              {s.refs.length > 0 && <p className="break-all font-mono text-xs text-muted-foreground">{s.refs.join(' · ')}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Answer inspector (01 §M4): Trace · SQL · Sources · Policy. */
export function Inspector({ answer, pendingSteps }: { answer: AgentAnswer | null; pendingSteps?: TraceStep[] }) {
  const [tab, setTab] = useState<Tab>('trace');
  return (
    <section aria-label={copy.ask.inspector} className="flex min-h-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-testid="inspector">
      <h2 className="text-base font-semibold">{copy.ask.inspector}</h2>
      <div role="tablist" aria-label={copy.ask.inspector} className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            id={`insp-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`insp-panel-${t}`}
            onClick={() => setTab(t)}
            data-tab={t}
            className={cn('-mb-px min-h-[24px] border-b-2 px-3 py-1.5 text-sm', tab === t ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground')}
          >
            {copy.ask.tabs[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`insp-panel-${tab}`} aria-labelledby={`insp-tab-${tab}`} className="min-h-0 overflow-auto">
        {pendingSteps && pendingSteps.length > 0 && !answer ? (
          <TraceList steps={pendingSteps} live />
        ) : !answer ? (
          <p className="text-sm text-muted-foreground">{copy.ask.inspectorEmpty}</p>
        ) : tab === 'trace' ? (
          <TraceList steps={answer.trace} />
        ) : tab === 'sql' ? (
          answer.result ? (
            <div className="flex flex-col gap-2">
              <CodeBlock code={answer.result.displaySql} label="Governed SQL" />
              <p className="text-xs text-muted-foreground">
                {answer.result.rows.length} {copy.ask.rows} · {answer.result.elapsedMs} ms · {answer.result.queryLogId}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{copy.ask.noSql}</p>
          )
        ) : tab === 'sources' ? (
          answer.citations.length ? (
            <div className="flex flex-col gap-3">
              <CitationChips citations={answer.citations.filter((c) => c.kind !== 'sql')} />
              <ul className="flex flex-col gap-2 text-sm">
                {answer.citations
                  .filter((c) => c.kind === 'document' || c.kind === 'rule' || c.kind === 'verified_query')
                  .map((c) => (
                    <li key={c.ref} className="rounded-md border border-border p-2">
                      <p className="font-medium">{c.label}</p>
                      {c.detail && <p className="text-muted-foreground">{c.detail}</p>}
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{copy.ask.noSources}</p>
          )
        ) : answer.result?.policiesApplied.length ? (
          <PolicyChips policies={answer.result.policiesApplied} />
        ) : (
          <p className="text-sm text-muted-foreground">{copy.ask.noPolicies}</p>
        )}
      </div>
    </section>
  );
}
