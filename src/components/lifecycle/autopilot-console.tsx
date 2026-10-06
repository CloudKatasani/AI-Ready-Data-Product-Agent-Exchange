'use client';

import { Pause, Play, SkipForward, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { copy } from '@/copy/en';
import { type ActionResult, ResultNote, useAction } from './use-action';

export interface AutopilotProps {
  run: { id: string; state: string; steps: { stage: number; kind: string; text: string }[] } | null;
  act: (op: 'start' | 'step' | 'cancel') => Promise<ActionResult>;
}

const SPEEDS = [
  { label: 'Instant', ms: 50 },
  { label: '1 s', ms: 1000 },
  { label: '3 s', ms: 3000 },
];

/** Autopilot (06 §4): steps stage by stage and pauses at every review and every gate for a human. */
export function AutopilotConsole({ run, act }: AutopilotProps) {
  const a = useAction();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiting = run && ['AWAITING_REVIEW', 'AWAITING_GATE', 'COMPLETED', 'CANCELLED'].includes(run.state);
  useEffect(() => {
    if (!playing || a.pending) return;
    if (waiting) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => a.run(() => act('step')), speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, a, act, speed, waiting, run?.steps.length]);
  return (
    <section aria-labelledby="ap-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-testid="autopilot">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ap-h" className="font-semibold">
          {copy.studio.autopilot}
        </h2>
        {run && <span className="rounded-full border border-border px-2 py-0.5 text-xs" data-testid="autopilot-state">{run.state.replace('_', ' ').toLowerCase()}</span>}
        <label className="ml-auto flex items-center gap-1 text-xs">
          {copy.studio.speed}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="h-7 rounded-md border border-border bg-background px-1">
            {SPEEDS.map((s) => (
              <option key={s.ms} value={s.ms}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={a.pending} onClick={() => a.run(() => act(run && !['COMPLETED', 'CANCELLED'].includes(run.state) ? 'step' : 'start'))} className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-sm text-primary-foreground" data-testid="autopilot-step">
          <SkipForward aria-hidden className="size-4" />
          {run && !['COMPLETED', 'CANCELLED'].includes(run.state) ? copy.studio.autopilotStep : copy.studio.autopilotStart}
        </button>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm">
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          {playing ? copy.studio.autopilotPause : copy.studio.autopilotPlay}
        </button>
        {run && !['COMPLETED', 'CANCELLED'].includes(run.state) && (
          <button type="button" onClick={() => a.run(() => act('cancel'))} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm">
            <Square aria-hidden className="size-4" />
            {copy.studio.autopilotCancel}
          </button>
        )}
      </div>
      {run && run.steps.length > 0 && (
        <ol className="flex max-h-56 flex-col gap-1 overflow-auto text-xs" aria-live="polite">
          {run.steps.slice(-8).map((s, i) => (
            <li key={i}>
              <span className="font-mono text-muted-foreground">S{s.stage}</span> {s.text}
            </li>
          ))}
        </ol>
      )}
      <ResultNote result={a.result} />
    </section>
  );
}
