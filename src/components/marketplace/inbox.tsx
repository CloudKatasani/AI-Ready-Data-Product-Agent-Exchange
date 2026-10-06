'use client';

import { useState, useTransition } from 'react';
import { copy } from '@/copy/en';

export interface InboxRow {
  id: string;
  productName: string;
  requester: string;
  purpose: string;
  justification: string;
  durationDays: number;
  approverRoles: string[];
  stillMasked: number;
  rowFilter: string | null;
}

/** Approver inbox: approve/deny with rationale; the decision goes through recordDecision() server-side. */
export function ApprovalInbox({ rows, decide }: { rows: InboxRow[]; decide: (id: string, outcome: 'APPROVE' | 'REJECT', rationale: string) => Promise<{ ok: boolean; state?: string; error?: string }> }) {
  const [done, setDone] = useState<Record<string, string>>({});
  const [why, setWhy] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  // Decided rows leave the server's pending list on revalidation; keep them on screen with their outcome.
  const [kept, setKept] = useState<InboxRow[]>([]);
  const shown = [...rows, ...kept.filter((k) => !rows.some((r) => r.id === k.id))];
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">{copy.access.inboxEmpty}</p>;
  return (
    <ul className="flex flex-col gap-3" data-testid="inbox">
      {shown.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm" data-request={r.id}>
          <p className="font-semibold">
            {r.requester} → {r.productName}
          </p>
          <p className="text-muted-foreground">
            {r.purpose} · {r.durationDays} {copy.access.request.days} · {r.approverRoles.join(', ')}
          </p>
          <p>“{r.justification}”</p>
          <p className="text-xs text-muted-foreground">
            {copy.access.request.stillMasked}: {r.stillMasked} · {copy.access.request.rowFilter}: {r.rowFilter ?? copy.access.request.none}
          </p>
          {done[r.id] ? (
            <p role="status" className="font-medium" data-testid="inbox-result">
              {done[r.id]}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`why-${r.id}`}>
                {copy.access.rationale}
              </label>
              <input id={`why-${r.id}`} value={why[r.id] ?? ''} onChange={(e) => setWhy((w) => ({ ...w, [r.id]: e.target.value }))} placeholder={copy.access.rationalePlaceholder} maxLength={500} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2" />
              {(['APPROVE', 'REJECT'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={pending}
                  data-testid={o === 'APPROVE' ? 'approve' : 'deny'}
                  onClick={() =>
                    start(async () => {
                      setKept((k) => [...k, r]);
                      const res = await decide(r.id, o, why[r.id] ?? '');
                      setDone((d) => ({ ...d, [r.id]: res.ok ? copy.access.states[(res.state ?? 'PENDING') as keyof typeof copy.access.states] : (res.error ?? '') }));
                    })
                  }
                  className={o === 'APPROVE' ? 'h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground' : 'h-8 rounded-md border border-border px-3'}
                >
                  {o === 'APPROVE' ? copy.access.approve : copy.access.deny}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
