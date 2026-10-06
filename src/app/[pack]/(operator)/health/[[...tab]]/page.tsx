import { notFound } from 'next/navigation';
import { LinkTabs } from '@/components/explorer/tabs';
import { LineageGraph } from '@/components/graph/lineage-graph';
import { ActionButton } from '@/components/operate/action-button';
import { HealthState, Signal } from '@/components/operate/signal';
import { optionalSegments } from '@/components/shell/route-params';
import { copy } from '@/copy/en';
import { impactOf } from '@/lib/operate/impact';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { healthBoard, incidents } from '@/lib/presenter/operate';
import { breakIncidentAction, resolveIncidentAction } from '../../actions';

const c = copy.operate.health;

export default async function HealthPage({ params, searchParams }: { params: Promise<{ pack: string; tab?: string[] }>; searchParams: Promise<{ incident?: string }> }) {
  const { pack: packId, tab: segs } = await params;
  const { incident: focus } = await searchParams;
  const { tab = 'board' } = optionalSegments(segs, ['tab'] as const);
  if (tab !== 'board' && tab !== 'incidents') notFound();
  const pack = getPack(packId);
  const [board, list] = await Promise.all([healthBoard(packId).catch(() => []), incidents(packId).catch(() => [])]);
  const openIds = new Set(list.filter((i) => i.state !== 'RESOLVED').map((i) => i.templateId));
  const name = (id: string) => pack.products.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </header>
      <LinkTabs label={c.title} active={tab} tabs={[{ id: 'board', label: c.tabs.board, href: `/${packId}/health` }, { id: 'incidents', label: `${c.tabs.incidents} (${openIds.size})`, href: `/${packId}/health/incidents` }]} />

      {tab === 'board' && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm" data-testid="health-board">
              <caption className="sr-only">{c.tabs.board}</caption>
              <thead className="bg-muted text-left">
                <tr>
                  {[c.product, c.status, c.freshness, c.volume, c.quality, c.schema, c.dq].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.productId} className="border-t border-border" data-product={r.productId} data-status={r.status}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {r.name} <span className="text-xs text-muted-foreground">{r.productId}</span>
                    </th>
                    <td className="px-3 py-2"><HealthState value={r.status} /></td>
                    <td className="px-3 py-2"><Signal value={r.freshness} /></td>
                    <td className="px-3 py-2"><Signal value={r.volume} /></td>
                    <td className="px-3 py-2"><Signal value={r.quality} /></td>
                    <td className="px-3 py-2"><Signal value={r.schema} /></td>
                    <td className="px-3 py-2 tabular-nums">{r.dqScore ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section aria-labelledby="break-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <h2 id="break-h" className="text-lg font-semibold">{c.breakTitle}</h2>
            <p className="text-sm text-muted-foreground">{c.breakIntro}</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {pack.incidents.map((t) => (
                <li key={t.id} className={`flex flex-col gap-2 rounded-md border p-3 ${focus === t.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`} data-template={t.id} data-selected={focus === t.id}>
                  <p className="font-medium">
                    {t.title} <span className="text-xs text-muted-foreground">{t.id} · {t.severity} · {t.kind.replace('_', ' ')}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{t.affects.products.map(name).join(', ')}</p>
                  {openIds.has(t.id) ? <p className="text-sm font-medium text-fail" data-testid={`open-${t.id}`}>{c.open}</p> : <ActionButton action={breakIncidentAction.bind(null, packId, t.id)} label={c.breakIt} testId={`break-${t.id}`} tone="danger" />}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === 'incidents' && (
        <section className="flex flex-col gap-4" data-testid="incident-list">
          {list.length === 0 && <p className="text-muted-foreground">{c.none}</p>}
          {list.map((i) => {
            const blast = impactOf(pack, getRubrics(), { fqn: i.object, change: 'delay' });
            return (
              <article key={i.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-incident={i.templateId} data-state={i.state}>
                <header className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-lg font-semibold">{i.title}</h2>
                  <span className="text-sm text-muted-foreground">
                    {i.templateId} · {i.severity} · {i.state.toLowerCase()} · {c.opened} {i.detectedAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </header>
                <p className="text-sm">{i.narrative}</p>
                {i.state !== 'RESOLVED' && <ActionButton action={resolveIncidentAction.bind(null, packId, i.id)} label={c.resolve} testId={`resolve-${i.templateId}`} tone="primary" />}
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    {c.blast}: {blast.products.length} products, {blast.agents.length} agents, {blast.metrics.length} metrics
                  </summary>
                  <div className="mt-2">
                    <LineageGraph nodes={blast.graph.nodes.map((n) => ({ id: n.id, label: n.label, layer: n.layer, focus: n.id === i.object }))} edges={blast.graph.edges} height={320} />
                  </div>
                </details>
                {i.postmortem && (
                  <section aria-label={c.postmortem} className="rounded-md border border-border p-3 text-sm" data-testid="postmortem">
                    <h3 className="font-semibold">{c.postmortem}</h3>
                    <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
                      <dt className="text-muted-foreground">{c.ttd}</dt>
                      <dd>{i.postmortem.timeToDetectMinutes} {c.minutes}</dd>
                      <dt className="text-muted-foreground">{c.ttr}</dt>
                      <dd>{i.postmortem.timeToResolveMinutes} {c.minutes}</dd>
                      <dt className="text-muted-foreground">{c.detection}</dt>
                      <dd>{i.postmortem.detection}</dd>
                      <dt className="text-muted-foreground">{c.resolution}</dt>
                      <dd>{i.postmortem.resolution}</dd>
                    </dl>
                    <h4 className="mt-2 font-medium">{c.actions}</h4>
                    <ul className="list-disc pl-5">
                      {i.postmortem.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
