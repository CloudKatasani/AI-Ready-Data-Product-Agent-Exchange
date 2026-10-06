'use client';

import { ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { copy } from '@/copy/en';
import type { DuplicateCandidate } from '@/lib/marketplace/demand';

export interface DemandRow {
  id: string;
  kind: string;
  title: string;
  description: string;
  votes: number;
  state: string;
  votedByMe: boolean;
  createdBy: string;
}

export interface DemandBoardProps {
  packId: string;
  items: DemandRow[];
  vote: (id: string) => Promise<void>;
  submit: (input: { kind: 'PRODUCT' | 'AGENT'; title: string; description: string; force?: boolean }) => Promise<{ ok: boolean; duplicates?: DuplicateCandidate[]; error?: string }>;
}

export function DemandBoard({ packId, items, vote, submit }: DemandBoardProps) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<'PRODUCT' | 'AGENT'>('PRODUCT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dups, setDups] = useState<DuplicateCandidate[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const send = (force: boolean) =>
    start(async () => {
      const r = await submit({ kind, title, description, force });
      if (r.ok) {
        setMsg(copy.marketplace.demand.submitted);
        setDups(null);
        setTitle('');
        setDescription('');
      } else if (r.duplicates) setDups(r.duplicates);
      else setMsg(r.error ?? null);
    });
  const href = (d: DuplicateCandidate) => (d.kind === 'product' ? `/${packId}/marketplace/products/${d.id}` : d.kind === 'agent' ? `/${packId}/ask/${d.id}` : `/${packId}/marketplace?tab=demand#${d.id}`);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ol className="flex flex-col gap-3" data-testid="demand-list">
        {items.map((d) => (
          <li key={d.id} id={d.id} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
            <button type="button" disabled={pending || d.votedByMe} onClick={() => start(() => vote(d.id))} aria-label={`${d.votedByMe ? copy.marketplace.demand.voted : copy.marketplace.demand.vote}: ${d.title}`} className="flex min-w-14 flex-col items-center justify-center rounded-md border border-border px-2 py-1 text-sm disabled:opacity-70" data-testid="vote">
              <ThumbsUp aria-hidden className="size-4" />
              <span className="font-semibold tabular-nums">{d.votes}</span>
            </button>
            <div className="min-w-0">
              <p className="font-semibold">
                {d.title} <span className="text-xs font-normal text-muted-foreground">· {d.kind.toLowerCase()} · {d.id}</span>
              </p>
              <p className="text-sm text-muted-foreground">{d.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <form
        className="flex h-fit flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(false);
        }}
      >
        <h3 className="font-semibold">{copy.marketplace.demand.add}</h3>
        <label className="flex flex-col gap-1 text-sm">
          {copy.marketplace.demand.kind}
          <select value={kind} onChange={(e) => setKind(e.target.value as 'PRODUCT' | 'AGENT')} className="h-9 rounded-md border border-border bg-background px-2">
            <option value="PRODUCT">{copy.marketplace.tabs.products}</option>
            <option value="AGENT">{copy.marketplace.tabs.agents}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.marketplace.demand.titleLabel}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="h-9 rounded-md border border-border bg-background px-2" data-testid="demand-title" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.marketplace.demand.description}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} className="rounded-md border border-border bg-background p-2" data-testid="demand-description" />
        </label>
        <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="demand-submit">
          {copy.marketplace.demand.submit}
        </button>
        {dups && (
          <div role="status" className="flex flex-col gap-2 rounded-md border border-in-certification/50 bg-in-certification/10 p-3 text-sm" data-testid="demand-duplicates">
            <p>{copy.marketplace.demand.duplicates}</p>
            <ul className="list-disc pl-5">
              {dups.map((d) => (
                <li key={`${d.kind}-${d.id}`}>
                  <Link href={href(d)} className="underline">
                    {d.name}
                  </Link>{' '}
                  <span className="text-muted-foreground">({Math.round(d.similarity * 100)}%)</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => send(true)} className="self-start text-primary underline">
              {copy.marketplace.demand.submitAnyway}
            </button>
          </div>
        )}
        {msg && (
          <p role="status" className="text-sm">
            {msg}
          </p>
        )}
      </form>
    </div>
  );
}
