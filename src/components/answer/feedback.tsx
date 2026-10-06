'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState, useTransition } from 'react';
import { copy } from '@/copy/en';

/** 👍/👎 with an optional reason; 👎 lands in the Agent Quality inbox (AnswerFeedback, state NEW). */
export function Feedback({ answerId, packId }: { answerId: string; packId: string }) {
  const [state, setState] = useState<'idle' | 'reason' | 'sent'>('idle');
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const send = (rating: 1 | -1, why?: string) =>
    start(async () => {
      await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pack: packId, answerId, rating, reason: why }) });
      setState('sent');
    });
  if (state === 'sent') return <p className="text-xs text-muted-foreground" role="status">{copy.ask.feedbackThanks}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" aria-label={copy.ask.helpful} disabled={pending} onClick={() => send(1)} className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-md border border-border p-1 hover:bg-muted">
        <ThumbsUp aria-hidden className="size-3.5" />
      </button>
      <button type="button" aria-label={copy.ask.notHelpful} disabled={pending} onClick={() => setState('reason')} className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-md border border-border p-1 hover:bg-muted">
        <ThumbsDown aria-hidden className="size-3.5" />
      </button>
      {state === 'reason' && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(-1, reason);
          }}
        >
          <label className="sr-only" htmlFor={`fb-${answerId}`}>
            {copy.ask.feedbackReason}
          </label>
          <input id={`fb-${answerId}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={copy.ask.feedbackReason} className="h-7 rounded-md border border-border bg-background px-2" maxLength={500} />
          <button type="submit" disabled={pending} className="min-h-[24px] rounded-md bg-primary px-2 text-primary-foreground">
            {copy.ask.feedbackSend}
          </button>
        </form>
      )}
    </div>
  );
}
