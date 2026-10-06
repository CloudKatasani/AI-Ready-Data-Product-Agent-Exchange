'use client';

import { CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { copy } from '@/copy/en';
import type { PolicyPreview } from '@/lib/marketplace/access';

export interface RequestAccessProps {
  packId: string;
  productId: string;
  productName: string;
  purposes: string[];
  durations: number[];
  defaultDuration: number;
  closeHref: string;
  preview: (purpose: string) => Promise<PolicyPreview | null>;
  submit: (input: { productId: string; purpose: string; justification: string; durationDays: number }) => Promise<{ ok: boolean; state?: string; error?: string }>;
}

/** Request-access drawer with a live policy preview (06 §6). */
export function RequestAccess({ productId, productName, purposes, durations, defaultDuration, closeHref, preview, submit }: RequestAccessProps) {
  const [purpose, setPurpose] = useState(purposes[0] ?? '');
  const [duration, setDuration] = useState(defaultDuration);
  const [justification, setJustification] = useState('');
  const [p, setP] = useState<PolicyPreview | null>(null);
  const [result, setResult] = useState<{ ok: boolean; state?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    let live = true;
    void preview(purpose).then((x) => live && setP(x));
    return () => {
      live = false;
    };
  }, [purpose, preview]);

  return (
    <aside role="dialog" aria-labelledby="req-h" aria-modal="false" className="flex flex-col gap-4 rounded-lg border border-primary bg-surface p-5 shadow-lg" data-testid="request-drawer">
      <div className="flex items-center gap-2">
        <h2 id="req-h" className="text-lg font-semibold">
          {copy.access.request.title}: {productName}
        </h2>
        <Link href={closeHref} aria-label={copy.access.request.cancel} className="ml-auto inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-md hover:bg-muted">
          <X aria-hidden className="size-4" />
        </Link>
      </div>
      {result?.ok ? (
        <p role="status" className="flex items-center gap-2 text-sm" data-testid="request-result" data-state={result.state}>
          <CheckCircle2 aria-hidden className="size-5 text-certified" />
          {result.state === 'GRANTED' ? copy.access.request.granted : copy.access.request.submitted}
        </p>
      ) : (
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setResult(await submit({ productId, purpose, justification, durationDays: duration })));
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            {copy.access.request.purpose}
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2" data-testid="request-purpose">
              {purposes.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {copy.access.request.duration}
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-9 rounded-md border border-border bg-background px-2">
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} {copy.access.request.days}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            {copy.access.request.justification}
            <textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder={copy.access.request.justificationPlaceholder} rows={2} maxLength={1000} className="rounded-md border border-border bg-background p-2" data-testid="request-justification" />
          </label>
          {result?.error && (
            <p role="alert" className="text-sm text-fail md:col-span-2">
              {result.error}
            </p>
          )}
          <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground md:col-span-2 md:justify-self-start" data-testid="request-submit">
            {copy.access.request.submit}
          </button>
        </form>
      )}
      {p && (
        <section aria-labelledby="preview-h" className="rounded-md border border-border bg-background p-3 text-sm" data-testid="policy-preview" data-auto={p.autoApprove}>
          <h3 id="preview-h" className="mb-2 font-semibold">
            {copy.access.request.preview}
          </h3>
          <ul className="mb-2 list-disc pl-5 text-muted-foreground">
            {p.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <dl className="grid grid-cols-[12rem_1fr] gap-y-1">
            <dt className="text-muted-foreground">{copy.access.request.approvers}</dt>
            <dd>{p.autoApprove ? copy.access.request.auto : p.approvers.map((a) => `${a.name} (${a.roles.join(', ')})`).join('; ') || p.requiredApproverRoles.join(', ')}</dd>
            <dt className="text-muted-foreground">{copy.access.request.stillMasked}</dt>
            <dd className="break-all font-mono text-xs">{p.maskedColumns.length ? p.maskedColumns.join(', ') : copy.access.request.none}</dd>
            <dt className="text-muted-foreground">{copy.access.request.rowFilter}</dt>
            <dd>{p.rowFilter ? `${p.rowFilter.policyId}: ${p.rowFilter.detail}` : copy.access.request.none}</dd>
            <dt className="text-muted-foreground">{copy.access.request.policies}</dt>
            <dd>{p.policies.length ? p.policies.map((x) => x.id).join(', ') : copy.access.request.none}</dd>
          </dl>
        </section>
      )}
    </aside>
  );
}
