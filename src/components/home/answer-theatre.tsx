'use client';

import { Pause, Play, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CitationChips } from '@/components/answer/citations';
import { TraceList } from '@/components/answer/inspector';
import { copy } from '@/copy/en';
import type { AgentAnswer } from '@/lib/agents/types';

export interface TheatreItem {
  answer: AgentAnswer;
  agentName: string;
}

/** Answer Theatre (01 §M2): replays golden Q&As; pausable; does not auto-advance under reduced motion. */
export function AnswerTheatre({ items, packId }: { items: TheatreItem[]; packId: string }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);
  const item = items[i];
  const total = item?.answer.trace.length ?? 0;
  useEffect(() => {
    if (!playing || !item) return;
    const t = setTimeout(() => {
      if (step < total) setStep((s) => s + 1);
      else {
        setStep(0);
        setI((x) => (x + 1) % items.length);
      }
    }, step < total ? 450 : 6000);
    return () => clearTimeout(t);
  }, [playing, step, total, item, items.length]);
  if (!item) return null;
  const shown = playing ? step : total;
  return (
    <section aria-labelledby="theatre-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm" data-testid="answer-theatre">
      <div className="flex items-center gap-2">
        <h2 id="theatre-h" className="text-base font-semibold">
          {copy.home.theatre}
        </h2>
        <span className="text-xs text-muted-foreground">
          {i + 1}/{items.length}
        </span>
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? copy.home.theatrePause : copy.home.theatrePlay} className="ml-auto inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-md border border-border">
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setI((x) => (x + 1) % items.length);
          }}
          aria-label={copy.home.theatreNext}
          className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-md border border-border"
        >
          <SkipForward aria-hidden className="size-4" />
        </button>
      </div>
      <p className="text-sm">
        <span className="font-semibold">{copy.ask.you}:</span> {item.answer.question}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <TraceList steps={item.answer.trace.slice(0, shown)} />
        {shown >= total && (
          <div className="flex flex-col gap-2" data-testid="theatre-answer">
            <p className="text-xs font-semibold text-agent">{item.agentName}</p>
            <p className="font-semibold">{item.answer.headline}</p>
            <p className="text-sm text-muted-foreground">{item.answer.narrative}</p>
            <CitationChips citations={item.answer.citations.filter((c) => c.kind !== 'sql' && c.kind !== 'document')} />
            <Link href={`/${packId}/ask/${item.answer.agentId}?q=${encodeURIComponent(item.answer.question)}`} className="min-h-[24px] text-sm text-primary underline-offset-2 hover:underline">
              {copy.ask.askAgent} {item.agentName}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
