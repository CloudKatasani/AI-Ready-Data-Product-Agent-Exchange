import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { ApprovalInbox } from '@/components/marketplace/inbox';
import { copy } from '@/copy/en';
import { db } from '@/lib/db';
import { approverInbox, myRequests } from '@/lib/marketplace/access';
import { kpiCoverage } from '@/lib/marketplace/coverage';
import { getPack } from '@/lib/packs/registry';
import { activePersona, activePrincipal } from '../../_server/session';
import { decideAccess } from './actions';

async function load(packId: string, personaId: string) {
  try {
    const prisma = db();
    const [inbox, requests, ents] = await Promise.all([approverInbox(prisma, getPack(packId), personaId), myRequests(prisma, packId, personaId), prisma.entitlement.findMany({ where: { personaId, revokedAt: null } })]);
    return { inbox, requests, ents };
  } catch {
    return { inbox: [], requests: [], ents: [] };
  }
}

export default async function MyAccessPage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  const who = await activePrincipal(pack);
  const { inbox, requests, ents } = await load(packId, persona.id);
  const coverage = kpiCoverage(pack, who);
  const expiry = (subjectId: string) => ents.find((e) => e.subjectId === subjectId)?.expiresAt;
  const date = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{copy.access.title}</h1>
        <p className="text-muted-foreground">{copy.access.intro}</p>
      </header>

      <section aria-labelledby="inbox-h" className="flex flex-col gap-2">
        <h2 id="inbox-h" className="text-lg font-semibold">
          {copy.access.inbox} <span className="text-sm font-normal text-muted-foreground">({inbox.length})</span>
        </h2>
        <ApprovalInbox
          decide={decideAccess.bind(null, packId)}
          rows={inbox.map((i) => ({ id: i.id, productName: i.productName, requester: i.requester, purpose: i.purpose, justification: i.justification, durationDays: i.durationDays, approverRoles: i.myRoles, stillMasked: i.preview.maskedColumns.length, rowFilter: i.preview.rowFilter?.detail ?? null }))}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="mb-2 text-lg font-semibold">
            {copy.access.products}
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm" data-testid="my-products">
            {pack.products
              .filter((p) => who.entitlements.includes(p.id))
              .map((p) => {
                const exp = expiry(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2" data-product={p.id}>
                    <Link href={`/${packId}/marketplace/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <span className="ml-auto text-xs text-muted-foreground">{exp ? `${copy.access.expires} ${date(exp)}` : copy.access.noExpiry}</span>
                  </li>
                );
              })}
          </ul>
          <h2 className="mb-2 mt-4 text-lg font-semibold">{copy.access.agents}</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {pack.agents
              .filter((a) => a.products.some((b) => who.entitlements.includes(b.id)))
              .map((a) => (
                <li key={a.id}>
                  <Link href={`/${packId}/ask/${a.id}`} className="inline-block rounded-full border border-agent px-3 py-1 hover:bg-muted">
                    {a.name}
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        <section aria-labelledby="req-h">
          <h2 id="req-h" className="mb-2 text-lg font-semibold">
            {copy.access.pending}
          </h2>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.access.noRequests}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm" data-testid="my-requests">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2" data-state={r.state}>
                  <span className="font-medium">{pack.products.find((p) => p.id === r.productId)?.name ?? r.productId}</span>
                  <span className="text-muted-foreground">· {r.purpose}</span>
                  <span className="ml-auto text-xs font-medium">{copy.access.states[r.state as keyof typeof copy.access.states] ?? r.state}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="cov-h">
        <h2 id="cov-h" className="text-lg font-semibold">
          {copy.access.coverage}
        </h2>
        <p className="mb-2 text-sm text-muted-foreground">{copy.access.coverageIntro}</p>
        <div role="region" aria-label={copy.access.coverage} tabIndex={0} className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm" data-testid="kpi-coverage">
            <tbody>
              {coverage.map((c) => (
                <tr key={c.kpiId} className="border-t border-border first:border-t-0" data-kpi={c.kpiId} data-answerable={c.answerable}>
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {c.name}
                  </th>
                  <td className="px-3 py-1.5">
                    {c.answerable ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 aria-hidden className="size-4 text-certified" />
                        {copy.access.yes}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <XCircle aria-hidden className="size-4 text-degraded" />
                        {copy.access.no}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {c.answerable && c.viaAgent ? (
                      <>
                        {copy.access.via} {c.viaAgent.name}
                      </>
                    ) : c.needsProduct ? (
                      <>
                        {copy.access.needs}{' '}
                        <Link className="text-primary underline" href={`/${packId}/marketplace/products/${c.needsProduct.id}?request=1`}>
                          {c.needsProduct.name}
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
