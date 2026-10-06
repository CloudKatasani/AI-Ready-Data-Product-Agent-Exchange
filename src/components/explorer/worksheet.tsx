'use client';

import { Play } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { PolicyChips } from '@/components/governance/policy-chips';
import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/ui/data-grid';
import { copy } from '@/copy/en';
import type { GovernedOutcome } from '@/lib/presenter/governed';

interface Props {
  pack: string;
  presets: { label: string; sql: string }[];
  locale: string;
  run: (packId: string, sql: string) => Promise<GovernedOutcome>;
}

/** Read-only SQL worksheet. Results obey the active persona's policies (sql-safety → policy engine). */
export function Worksheet({ pack, presets, locale, run }: Props) {
  const [sql, setSql] = useState(presets[0]?.sql ?? '');
  const [out, setOut] = useState<GovernedOutcome | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const execute = () => start(async () => setOut(await run(pack, sql)));

  return (
    <div className="flex flex-col gap-4" data-testid="worksheet">
      <p className="text-sm text-muted-foreground">{copy.explorer.worksheetIntro}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{copy.explorer.presets}:</span>
        {presets.map((p) => (
          <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => setSql(p.sql)}>
            {p.label}
          </Button>
        ))}
      </div>
      <label htmlFor={id} className="text-sm font-medium">
        {copy.explorer.sqlLabel}
      </label>
      <textarea
        id={id}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') execute();
        }}
        spellCheck={false}
        rows={8}
        className="w-full rounded-md border border-border bg-surface p-3 font-mono text-[13px]"
        data-testid="worksheet-sql"
      />
      <div>
        <Button type="button" onClick={execute} disabled={pending} data-testid="worksheet-run" aria-keyshortcuts="Control+Enter">
          <Play aria-hidden />
          {pending ? copy.explorer.running : copy.explorer.run}
        </Button>
      </div>
      <div aria-live="polite">
        {out && !out.ok && (
          <div role="alert" data-testid={`worksheet-${out.kind}`} className="rounded-md border border-degraded bg-surface p-4 text-sm">
            <p className="font-semibold">{copy.outcome[out.kind]}</p>
            <p>{out.message}</p>
            {out.kind === 'rejected' && <p className="text-muted-foreground">{out.hint}</p>}
          </div>
        )}
        {out?.ok && (
          <div className="flex flex-col gap-3" data-testid="worksheet-result">
            <p className="text-sm text-muted-foreground">
              {out.result.rowCount} {copy.explorer.rows}
              {out.result.truncated ? ' (truncated)' : ''}
            </p>
            <PolicyChips policies={out.result.policiesApplied} />
            <DataGrid columns={out.result.columns} rows={out.result.rows} masked={out.result.maskedColumns} locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}
