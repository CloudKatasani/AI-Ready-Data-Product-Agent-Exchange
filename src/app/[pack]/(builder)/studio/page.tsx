import { AlertTriangle, Bot } from 'lucide-react';
import Link from 'next/link';
import { LinkTabs } from '@/components/explorer/tabs';
import { StatusChip } from '@/components/marketplace/chips';
import { buttonVariants } from '@/components/ui/button';
import { copy } from '@/copy/en';
import { PHASES } from '@/lib/lifecycle/stages';
import type { ProductStatus } from '@/lib/marketplace/catalog';
import { getPack } from '@/lib/packs/registry';
import { type BoardCard, studioBoard } from '@/lib/presenter/studio';

async function board(packId: string): Promise<BoardCard[]> {
  try {
    return await studioBoard(getPack(packId));
  } catch {
    return [];
  }
}

function Card({ c, packId }: { c: BoardCard; packId: string }) {
  return (
    <Link href={`/${packId}/studio/${c.id}`} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 text-sm shadow-sm hover:border-primary" data-testid="studio-card" data-product={c.id}>
      <span className="font-semibold leading-tight">{c.name}</span>
      <span className="text-xs text-muted-foreground">
        {c.id} · v{c.version} · {c.owner}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <StatusChip status={c.status as ProductStatus} />
        <span className="rounded-full border border-border px-2 py-0.5">
          {copy.studio.stage} {c.stage}/12
        </span>
        {c.gateState && <span className="rounded-full border border-border px-2 py-0.5">{copy.studio.gateStates[c.gateState as keyof typeof copy.studio.gateStates] ?? c.gateState}</span>}
      </span>
      {(c.openProposals > 0 || c.stale > 0) && (
        <span className="flex flex-wrap gap-2 text-xs">
          {c.openProposals > 0 && (
            <span className="inline-flex items-center gap-1">
              <Bot aria-hidden className="size-3.5 text-agent" />
              {c.openProposals} {copy.studio.proposals}
            </span>
          )}
          {c.stale > 0 && (
            <span className="inline-flex items-center gap-1">
              <AlertTriangle aria-hidden className="size-3.5 text-degraded" />
              {c.stale} {copy.studio.stale}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

export default async function StudioPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<{ view?: string; domain?: string }> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const view = sp.view === 'table' ? 'table' : 'board';
  const cards = (await board(packId)).filter((c) => !sp.domain || c.domain === sp.domain);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{copy.studio.title}</h1>
          <p className="text-muted-foreground">{copy.studio.intro}</p>
        </div>
        <Link href={`/${packId}/request/new`} className={`${buttonVariants({ variant: 'outline' })} ml-auto`}>
          {copy.studio.newRequest}
        </Link>
      </header>
      <LinkTabs label={copy.studio.title} active={view} tabs={[{ id: 'board', label: copy.studio.board, href: `/${packId}/studio` }, { id: 'table', label: copy.studio.table, href: `/${packId}/studio?view=table` }]} />
      {view === 'board' ? (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5" data-testid="studio-board">
          {PHASES.map((phase) => (
            <section key={phase} aria-labelledby={`ph-${phase}`} className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2">
              <h2 id={`ph-${phase}`} className="px-1 text-sm font-semibold">
                {phase} <span className="font-normal text-muted-foreground">({cards.filter((c) => c.phase === phase).length})</span>
              </h2>
              {cards
                .filter((c) => c.phase === phase)
                .map((c) => (
                  <Card key={c.id} c={c} packId={packId} />
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div role="region" aria-label={copy.studio.table} tabIndex={0} className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {['Product', 'Domain', 'Status', 'Stage', 'Gate', 'Proposals', 'Owner'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <Link href={`/${packId}/studio/${c.id}`} className="font-medium text-primary underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">{c.domain}</td>
                  <td className="px-3 py-1.5">
                    <StatusChip status={c.status as ProductStatus} />
                  </td>
                  <td className="px-3 py-1.5">{c.stage}/12</td>
                  <td className="px-3 py-1.5">{c.gateState ?? '—'}</td>
                  <td className="px-3 py-1.5">{c.openProposals}</td>
                  <td className="px-3 py-1.5">{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
