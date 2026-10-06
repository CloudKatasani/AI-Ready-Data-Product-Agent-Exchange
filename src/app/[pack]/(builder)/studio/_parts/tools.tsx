'use client';

import { ResultNote, useAction } from '@/components/lifecycle/use-action';
import { copy } from '@/copy/en';
import { runProfilingNow, runQualityNow } from '../actions';

/** Stage tools that execute against the warehouse (profiling at 3, DQ rules at 8). */
export function StudioTools({ packId, productId, stage }: { packId: string; productId: string; stage: number }) {
  const a = useAction();
  if (stage !== 3 && stage !== 8) return null;
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={a.pending} onClick={() => a.run(() => (stage === 3 ? runProfilingNow(packId, productId) : runQualityNow(packId, productId)))} className="h-9 self-start rounded-md border border-border px-3 text-sm" data-testid="run-stage-tool">
        {stage === 3 ? copy.studio.runProfiling : copy.studio.runDq}
      </button>
      <ResultNote result={a.result} />
    </div>
  );
}
