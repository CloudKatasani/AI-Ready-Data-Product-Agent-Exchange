'use client';

import { Presentation, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { copy } from '@/copy/en';

export interface OverlayStep {
  id: string;
  title: string;
  do: string[];
  say: string;
  href: string;
  checkpoint?: boolean;
  spotlight?: string;
}
export interface OverlayStory {
  id: string;
  title: string;
  minutes: number;
  steps: OverlayStep[];
}
type Result = { ok: boolean; message: string; href?: string };

const c = copy.presenter;
const KEY = 'ks_overlay';

interface Saved {
  open: boolean;
  storyId: string;
  at: number;
  startedAt: number | null;
  stepAt: number | null;
  leaveBehind: boolean;
}

function load(fallback: Saved): Saved {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(KEY) : null;
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Saved>) } : fallback;
  } catch {
    return fallback;
  }
}

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Presenter overlay (01 §M1, 09 §3): story rail, cue card, timers, Go, Reset, spotlight, leave-behind mode. Shift+P toggles. */
export function PresenterOverlay({ stories, defaultStoryId, profileName, goStep, reset, packId }: { stories: OverlayStory[]; defaultStoryId: string | null; profileName: string | null; goStep: (storyId: string, stepId: string) => Promise<Result>; reset: () => Promise<Result>; packId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState<Saved>({ open: false, storyId: defaultStoryId ?? stories[0]?.id ?? '', at: 0, startedAt: null, stepAt: null, leaveBehind: false });
  const [note, setNote] = useState<Result | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => setS((cur) => load(cur)), []);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // storage unavailable: the overlay still works for this page
    }
  }, [s]);
  useEffect(() => {
    if (!s.open || !s.startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s.open, s.startedAt]);

  const story = stories.find((x) => x.id === s.storyId) ?? stories[0];
  const step = story?.steps[Math.min(s.at, (story?.steps.length ?? 1) - 1)];
  const next = story?.steps[s.at + 1];

  const go = useCallback(
    (index: number) => {
      const target = story?.steps[index];
      if (!story || !target) return;
      start(async () => {
        const r = await goStep(story.id, target.id);
        setNote(r);
        if (r.ok && r.href) {
          const t = Date.now();
          setS((cur) => ({ ...cur, at: index, stepAt: t, startedAt: cur.startedAt ?? t }));
          router.push(r.href);
          router.refresh();
        }
      });
    },
    [story, goStep, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      if (typing || !e.shiftKey) return;
      if (e.key === 'P') setS((cur) => ({ ...cur, open: !cur.open }));
      else if (e.key === 'ArrowRight' && s.open) go(Math.min(s.at + 1, (story?.steps.length ?? 1) - 1));
      else if (e.key === 'ArrowLeft' && s.open) go(Math.max(s.at - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, s.open, s.at, story]);

  useEffect(() => {
    if (!s.open || !step?.spotlight) return;
    const el = document.querySelector<HTMLElement>(step.spotlight);
    if (!el) return;
    el.dataset.spotlight = 'on';
    el.scrollIntoView({ block: 'center' });
    return () => {
      delete el.dataset.spotlight;
    };
  }, [s.open, step]);

  if (!s.open) {
    return (
      <button type="button" onClick={() => setS({ ...s, open: true })} className="fixed bottom-4 right-4 z-40 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm shadow-lg" data-testid="presenter-open" aria-keyshortcuts="Shift+P">
        <Presentation aria-hidden className="size-4" />
        {c.open}
      </button>
    );
  }
  return (
    <aside aria-label={c.title} className="fixed bottom-4 right-4 z-40 flex max-h-[80vh] w-[26rem] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-surface p-4 text-sm shadow-xl" data-testid="presenter-overlay" data-story={story?.id} data-step={step?.id}>
      <header className="flex items-center gap-2">
        <h2 className="font-semibold">{c.title}</h2>
        {profileName && <span className="truncate text-xs text-muted-foreground">· {profileName}</span>}
        <button type="button" onClick={() => setS({ ...s, open: false })} className="ml-auto rounded p-1 hover:bg-muted" aria-label={c.close}>
          <X aria-hidden className="size-4" />
        </button>
      </header>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{c.story}</span>
        <select value={story?.id} onChange={(e) => setS({ ...s, storyId: e.target.value, at: 0, startedAt: null, stepAt: null })} className="h-9 rounded-md border border-border bg-surface px-2" data-testid="presenter-story">
          {stories.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title} ({x.minutes}′)
            </option>
          ))}
        </select>
      </label>
      <ol className="flex flex-col gap-1" data-testid="story-rail">
        {story?.steps.map((x, i) => (
          <li key={x.id} className={`flex items-center gap-2 rounded-md px-2 py-1 ${i === s.at ? 'bg-primary/10 font-semibold' : ''}`} aria-current={i === s.at ? 'step' : undefined}>
            <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="flex-1">{x.title}</span>
            <button type="button" disabled={pending} onClick={() => go(i)} className="h-7 rounded-md border border-border px-2 text-xs font-medium hover:border-primary disabled:opacity-60" data-testid={`go-${x.id}`}>
              {c.go}
            </button>
          </li>
        ))}
      </ol>
      {step && (
        <section aria-label={c.cue} className="rounded-md border border-border p-3" data-testid="cue-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.leaveBehind ? c.tryThis : c.doThis}</p>
          <ul className="list-disc pl-5">
            {step.do.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          {!s.leaveBehind && (
            <>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{c.sayThis}</p>
              <p className="italic">“{step.say}”</p>
            </>
          )}
          {next && (
            <p className="mt-2 text-xs text-muted-foreground">
              {c.next}: {next.title}
            </p>
          )}
        </section>
      )}
      {s.startedAt && (
        <p className="text-xs tabular-nums text-muted-foreground" data-testid="presenter-timers">
          {c.stepTime} {mmss(Math.max(0, now - (s.stepAt ?? s.startedAt)))} · {c.totalTime} {mmss(Math.max(0, now - s.startedAt))}
          {story ? ` / ${story.minutes}:00` : ''}
        </p>
      )}
      {note && (
        <p role="status" className={note.ok ? 'text-xs' : 'text-xs font-medium text-fail'} data-testid="presenter-note">
          {note.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {confirmReset ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await reset();
                setNote(r);
                setConfirmReset(false);
                if (r.ok) {
                  setS((cur) => ({ ...cur, at: 0, startedAt: null, stepAt: null }));
                  if (r.href) router.push(r.href);
                  router.refresh();
                }
              })
            }
            className="h-8 rounded-md border border-fail/60 px-3 text-xs font-medium"
            data-testid="presenter-reset-confirm"
          >
            {c.confirmReset}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)} className="h-8 rounded-md border border-border px-3 text-xs" data-testid="presenter-reset">
            {c.reset}
          </button>
        )}
        <a href={`/${packId}/health`} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs">
          {c.breakIt}
        </a>
        <a href={`/${packId}/health/incidents`} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs">
          {c.fixIt}
        </a>
        <label className="inline-flex items-center gap-1 text-xs">
          <input type="checkbox" checked={s.leaveBehind} onChange={(e) => setS({ ...s, leaveBehind: e.target.checked })} />
          {c.leaveBehind}
        </label>
        {story && (
          <a href={`/${packId}/story/${story.id}`} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs">
            {c.print}
          </a>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{c.shortcuts}</p>
    </aside>
  );
}
