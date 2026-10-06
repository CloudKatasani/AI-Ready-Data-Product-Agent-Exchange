'use client';

import { Bot, Send } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '@/copy/en';
import type { AgentAnswer, TraceStep } from '@/lib/agents/types';
import { cn } from '@/lib/utils';
import { AnswerCard } from './answer-card';
import { Inspector } from './inspector';
import { askStream } from './sse';

export interface AgentSummary {
  id: string;
  name: string;
  capability: string;
  status: string;
  hue: number;
}

interface Turn {
  key: number;
  question: string;
  agentId?: string;
  steps: TraceStep[];
  answer?: AgentAnswer;
  answerId?: string | null;
  error?: string;
}

export interface AskConsoleProps {
  packId: string;
  locale: string;
  agents: AgentSummary[];
  agentId?: string;
  suggestions: string[];
  initialQuestion?: string;
}

/** Ask an Agent (01 §M4): picker + suggestions | conversation | inspector. Streams `/api/ask` events. */
export function AskConsole({ packId, locale, agents, agentId, suggestions, initialQuestion }: AskConsoleProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const nextKey = useRef(0);
  const started = useRef(false);
  const name = (id?: string) => agents.find((a) => a.id === id)?.name ?? copy.ask.anyAgent;

  const askQuestion = useCallback(
    async (question: string, target?: string) => {
      const q = question.trim();
      if (!q) return;
      const key = nextKey.current++;
      const update = (fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.key === key ? fn(t) : t)));
      setTurns((ts) => [...ts, { key, question: q, agentId: target ?? agentId, steps: [] }]);
      setSelected(key);
      setBusy(true);
      setText('');
      try {
        for await (const e of askStream({ pack: packId, question: q, agentId: target ?? agentId })) {
          if (e.event === 'routed') update((t) => ({ ...t, agentId: e.data.agentId }));
          else if (e.event === 'step') update((t) => ({ ...t, steps: [...t.steps, e.data] }));
          else if (e.event === 'answer') update((t) => ({ ...t, answer: e.data.answer, answerId: e.data.answerId }));
          else if (e.event === 'error') update((t) => ({ ...t, error: e.data.message }));
        }
      } catch {
        update((t) => ({ ...t, error: copy.ask.error }));
      } finally {
        setBusy(false);
      }
    },
    [agentId, packId],
  );

  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      void askQuestion(initialQuestion);
    }
  }, [initialQuestion, askQuestion]);

  const current = turns.find((t) => t.key === selected);
  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_22rem]">
      <aside className="flex flex-col gap-4" aria-label={copy.ask.agents}>
        <nav aria-label={copy.ask.agents}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{copy.ask.agents}</h2>
          <ul className="flex flex-col gap-1">
            <li>
              <Link href={`/${packId}/ask`} aria-current={!agentId ? 'page' : undefined} className={cn('flex min-h-[24px] items-center gap-2 rounded-md px-2 py-1.5 text-sm', !agentId ? 'bg-muted font-semibold' : 'hover:bg-muted')}>
                <Bot aria-hidden className="size-4 text-agent" />
                {copy.ask.anyAgent}
              </Link>
            </li>
            {agents.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/${packId}/ask/${a.id}`}
                  aria-current={a.id === agentId ? 'page' : undefined}
                  title={a.capability}
                  data-agent={a.id}
                  className={cn('flex min-h-[24px] items-center gap-2 rounded-md px-2 py-1.5 text-sm', a.id === agentId ? 'bg-muted font-semibold' : 'hover:bg-muted')}
                >
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `hsl(${a.hue} 65% 45%)` }} />
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{a.status.toLowerCase()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="suggested-h">
          <h2 id="suggested-h" className="mb-2 text-sm font-semibold text-muted-foreground">
            {copy.ask.suggested}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <li key={s}>
                <button type="button" disabled={busy} onClick={() => void askQuestion(s)} className="min-h-[24px] w-full rounded-md border border-border px-2 py-1.5 text-left text-sm hover:border-primary" data-testid="suggested-question">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <section aria-label="Conversation" className="flex min-w-0 flex-col gap-4">
        <ol className="flex flex-col gap-4" aria-live="polite">
          {turns.length === 0 && <li className="text-sm text-muted-foreground">{copy.ask.empty}</li>}
          {turns.map((t) => (
            <li key={t.key} className="flex flex-col gap-2">
              <p className="self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" data-testid="question-bubble">
                <span className="sr-only">{copy.ask.you}: </span>
                {t.question}
              </p>
              {t.answer ? (
                <AnswerCard
                  answer={t.answer}
                  answerId={t.answerId ?? null}
                  packId={packId}
                  locale={locale}
                  agentName={name(t.answer.agentId)}
                  selected={selected === t.key}
                  onSelect={() => setSelected(t.key)}
                  onFollowup={(q, a) => void askQuestion(q, a)}
                />
              ) : t.error ? (
                <p role="status" className="rounded-md border border-degraded/40 bg-degraded/10 p-3 text-sm">
                  {t.error}
                </p>
              ) : (
                <p role="status" className="text-sm text-muted-foreground">
                  {name(t.agentId)} · {copy.ask.thinking} {t.steps.at(-1)?.label}
                </p>
              )}
            </li>
          ))}
        </ol>
        <form
          className="sticky bottom-0 flex gap-2 bg-background py-2"
          onSubmit={(e) => {
            e.preventDefault();
            void askQuestion(text);
          }}
        >
          <label htmlFor="ask-input" className="sr-only">
            {copy.ask.placeholder}
          </label>
          <input
            id="ask-input"
            data-testid="ask-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={copy.ask.placeholder}
            maxLength={500}
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm"
          />
          <button type="submit" disabled={busy || !text.trim()} className="inline-flex h-10 items-center gap-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
            <Send aria-hidden className="size-4" />
            {copy.ask.send}
          </button>
        </form>
      </section>

      <Inspector key={selected ?? -1} answer={current?.answer ?? null} pendingSteps={current?.steps} />
    </div>
  );
}
