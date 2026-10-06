'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { copy } from '@/copy/en';

export function TriagePanel({ packId, products, act }: { packId: string; products: { id: string; name: string }[]; act: (action: 'approve' | 'merge' | 'decline', arg: string) => Promise<{ ok: boolean; message: string; productId?: string }> }) {
  const [reason, setReason] = useState('');
  const [into, setInto] = useState(products[0]?.id ?? '');
  const [res, setRes] = useState<{ ok: boolean; message: string; productId?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="triage-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-testid="triage-panel">
      <h2 id="triage-h" className="font-semibold">
        {copy.intake.triage}
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        {copy.intake.reason}
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2" data-testid="triage-reason" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => start(async () => setRes(await act('approve', reason)))} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="triage-approve">
          {copy.intake.approve}
        </button>
        <select aria-label={copy.intake.merge} value={into} onChange={(e) => setInto(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending} onClick={() => start(async () => setRes(await act('merge', into)))} className="h-9 rounded-md border border-border px-3 text-sm">
          {copy.intake.merge}
        </button>
        <button type="button" disabled={pending} onClick={() => start(async () => setRes(await act('decline', reason)))} className="h-9 rounded-md border border-border px-3 text-sm">
          {copy.intake.decline}
        </button>
      </div>
      {res && (
        <p role="status" className="text-sm" data-testid="triage-result" data-ok={res.ok}>
          {res.message}{' '}
          {res.productId && (
            <Link href={`/${packId}/studio/${res.productId}`} className="text-primary underline">
              {copy.intake.openProduct}
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
