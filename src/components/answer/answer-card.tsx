'use client';

import { AlertTriangle, EyeOff, Filter, Lock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { copy } from '@/copy/en';
import type { AgentAnswer, Banner } from '@/lib/agents/types';
import { cn } from '@/lib/utils';
import { AnswerResultView } from './answer-result';
import { CitationChips } from './citations';
import { Feedback } from './feedback';

const BANNER_ICON: Record<Banner['kind'], typeof Lock> = { not_certified: ShieldAlert, no_access: Lock, masked: EyeOff, row_filtered: Filter, incident: AlertTriangle, fallback: AlertTriangle };
const CONFIDENCE_TONE = { trusted: 'border-certified text-certified', questionable: 'border-degraded text-degraded', unsafe: 'border-fail text-fail' } as const;

export interface AnswerCardProps {
  answer: AgentAnswer;
  answerId: string | null;
  packId: string;
  locale: string;
  agentName: string;
  selected?: boolean;
  onSelect?: () => void;
  onFollowup?: (q: string, agentId?: string) => void;
}

/** One agent answer: headline, narrative, chart/table, citations, confidence, banners, mode badge. */
export function AnswerCard({ answer, answerId, packId, locale, agentName, selected, onSelect, onFollowup }: AnswerCardProps) {
  const modeTitle = answer.mode === 'live_fallback' ? answer.fallbackReason : undefined;
  return (
    <article
      data-testid="answer-card"
      data-kind={answer.kind}
      data-scenario={answer.scenarioId}
      aria-label={`${agentName}: ${answer.headline}`}
      className={cn('flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-sm', selected ? 'border-primary' : 'border-border')}
    >
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-agent">{agentName}</span>
        <Badge variant="muted" data-testid="answer-kind">
          {copy.ask.kinds[answer.kind]}
        </Badge>
        <Badge variant="outline" title={modeTitle} data-testid="answer-mode" data-mode={answer.mode}>
          {copy.ask.modes[answer.mode]}
        </Badge>
        {answer.kind === 'answer' && (
          <span className={cn('rounded-full border px-2 py-0.5 font-medium', CONFIDENCE_TONE[answer.confidence])} data-testid="answer-confidence">
            {copy.ask.confidence[answer.confidence]}
          </span>
        )}
        {onSelect && (
          <button type="button" onClick={onSelect} className="ml-auto min-h-[24px] text-primary underline-offset-2 hover:underline" aria-pressed={selected}>
            {copy.ask.howAnswered}
          </button>
        )}
      </header>
      <p className="text-lg font-semibold leading-snug" data-testid="answer-headline">
        {answer.headline}
      </p>
      {answer.narrative && <p className="text-sm text-muted-foreground" data-testid="answer-narrative">{answer.narrative}</p>}
      {answer.banners.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Notices">
          {answer.banners.map((b, i) => {
            const Icon = BANNER_ICON[b.kind];
            return (
              <li key={i} data-banner={b.kind} className="flex items-center gap-2 rounded-md border border-degraded/40 bg-degraded/10 px-3 py-1.5 text-sm">
                <Icon aria-hidden className="size-4 shrink-0 text-degraded" />
                <span>{b.text}</span>
                {b.kind === 'no_access' && b.productId && (
                  <Link href={`/${packId}/marketplace/products/${b.productId}`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'ml-auto')}>
                    {copy.ask.request}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {answer.kind === 'decline' && answer.requestProductId && !answer.banners.some((b) => b.kind === 'no_access') && (
        <Link href={`/${packId}/marketplace/products/${answer.requestProductId}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          {copy.ask.request}
        </Link>
      )}
      <AnswerResultView answer={answer} locale={locale} />
      <CitationChips citations={answer.citations} />
      {answer.redirectTo && onFollowup && (
        <button type="button" className={cn(buttonVariants({ size: 'sm' }), 'self-start')} onClick={() => onFollowup(answer.question, answer.redirectTo?.agentId)} data-testid="redirect-button">
          {copy.ask.askAgent} {answer.redirectTo.name}
        </button>
      )}
      {(answer.suggestions?.length || answer.followups.length) && onFollowup ? (
        <nav aria-label={copy.ask.followups} className="flex flex-wrap gap-1.5">
          {[...new Set([...(answer.kind === 'clarify' ? (answer.suggestions ?? []) : []), ...answer.followups])].map((f) => (
            <button key={f} type="button" onClick={() => onFollowup(f)} className="min-h-[24px] rounded-full border border-primary/40 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/10" data-testid="followup-chip">
              {f}
            </button>
          ))}
        </nav>
      ) : null}
      {answerId && <Feedback answerId={answerId} packId={packId} />}
    </article>
  );
}
