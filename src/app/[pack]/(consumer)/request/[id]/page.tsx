import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TriagePanel } from '@/components/lifecycle/triage-panel';
import { copy } from '@/copy/en';
import { db } from '@/lib/db';
import type { DuplicateCandidate } from '@/lib/packs/similarity';
import { getPack } from '@/lib/packs/registry';
import { activePersona } from '../../../_server/session';
import { triage } from '../actions';

export default async function RequestDetailPage({ params }: { params: Promise<{ pack: string; id: string }> }) {
  const { pack: packId, id: raw } = await params;
  const pack = getPack(packId);
  const id = decodeURIComponent(raw);
  const r = await db().productRequest.findFirst({ where: { packId, OR: [{ id }, { reference: id }] } }).catch(() => null);
  if (!r) notFound();
  const persona = await activePersona(pack);
  const decision = JSON.parse(r.decisionJson) as { decision: string; decider: string; cadence: string; workaround: string };
  const questions = JSON.parse(r.questionsJson) as string[];
  const dups = JSON.parse(r.duplicateCandidatesJson) as DuplicateCandidate[];
  const canTriage = persona.roles.some((x) => x === 'DOMAIN_PRODUCT_OWNER' || x === 'DATA_STEWARD');
  const open = ['SUBMITTED', 'TRIAGE'].includes(r.state);
  const breached = Date.parse(`${pack.manifest.asOf}T23:59:59Z`) > r.slaDueAt.getTime() && open;
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link href={`/${packId}/request/new`} className="hover:underline">
            {copy.intake.requests}
          </Link>{' '}
          / {r.reference}
        </p>
        <h1 className="text-2xl font-semibold">{r.title}</h1>
        <p className="text-sm" data-testid="request-state" data-state={r.state}>
          {copy.intake.states[r.state as keyof typeof copy.intake.states] ?? r.state} · {pack.personas.find((p) => p.id === r.requesterId)?.name ?? r.requesterId} · {copy.intake.sla} {r.slaDueAt.toISOString().slice(0, 16).replace('T', ' ')}
          {breached ? ` · ${copy.intake.breached}` : ''}
        </p>
      </header>
      <dl className="grid grid-cols-[12rem_1fr] gap-y-1 rounded-lg border border-border bg-surface p-4 text-sm">
        <dt className="text-muted-foreground">{copy.intake.decision}</dt>
        <dd>{decision.decision}</dd>
        <dt className="text-muted-foreground">{copy.intake.decider}</dt>
        <dd>
          {decision.decider} · {decision.cadence}
        </dd>
        <dt className="text-muted-foreground">{copy.intake.workaround}</dt>
        <dd>{decision.workaround}</dd>
        <dt className="text-muted-foreground">{copy.intake.questions}</dt>
        <dd>
          <ul className="list-disc pl-5">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </dd>
        <dt className="text-muted-foreground">{copy.intake.stakes}</dt>
        <dd>{r.stakes}</dd>
        <dt className="text-muted-foreground">{copy.intake.freshness}</dt>
        <dd>{r.freshness}</dd>
      </dl>
      {dups.length > 0 && (
        <section className="rounded-lg border border-in-certification p-4 text-sm" data-testid="request-duplicates">
          <p className="font-medium">{copy.intake.duplicates}</p>
          <ul className="list-disc pl-5">
            {dups.map((d) => (
              <li key={`${d.kind}-${d.id}`}>
                <Link className="underline" href={d.kind === 'product' ? `/${packId}/marketplace/products/${d.id}` : `/${packId}/ask/${d.id}`}>
                  {d.name}
                </Link>{' '}
                · {Math.round(d.similarity * 100)}% {copy.intake.similarity}
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.createdProductId && (
        <Link className="text-primary underline" href={`/${packId}/studio/${r.createdProductId}`} data-testid="open-created-product">
          {copy.intake.openProduct}: {r.createdProductId}
        </Link>
      )}
      {open && (canTriage ? <TriagePanel packId={packId} products={pack.products.map((p) => ({ id: p.id, name: p.name }))} act={triage.bind(null, packId, r.id)} /> : <p className="text-sm text-muted-foreground">{copy.intake.noTriageRole}</p>)}
    </div>
  );
}
