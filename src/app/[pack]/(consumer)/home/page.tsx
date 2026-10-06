import { Search } from 'lucide-react';
import { AnswerTheatre, type TheatreItem } from '@/components/home/answer-theatre';
import { Constellation } from '@/components/home/constellation';
import { KpiTileCard } from '@/components/home/kpi-tile';
import { copy } from '@/copy/en';
import { respondScripted } from '@/lib/agents/scripted/respond';
import { answeredCount, recentAnswers } from '@/lib/presenter/ask';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { governedService } from '@/lib/presenter/governed';
import { headlineTiles, type KpiTile } from '@/lib/presenter/home';
import { rangeKeyFor } from '@/lib/presenter/playground';
import { activePrincipal } from '../../_server/session';

export default async function HomePage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  const pack = getPack(packId);
  const who = await activePrincipal(pack);
  let tiles: KpiTile[] = [];
  let theatre: TheatreItem[] = [];
  try {
    const qs = await governedService(packId);
    tiles = await headlineTiles(pack, qs, who);
    for (const id of pack.manifest.home.theatreScenarios) {
      const s = pack.scenarios.find((x) => x.id === id);
      if (!s) continue;
      const answer = await respondScripted(s.agent, s.question, { pack, rubrics: getRubrics(), qs, who });
      theatre.push({ answer, agentName: pack.agents.find((a) => a.id === s.agent)?.name ?? s.agent });
    }
  } catch {
    tiles = [];
    theatre = [];
  }
  const [answered, recent] = await Promise.all([answeredCount(packId), recentAnswers(packId)]);
  const counters = [
    { label: copy.home.counters.certified, value: pack.products.filter((p) => p.initial_status === 'CERTIFIED').length },
    { label: copy.home.counters.agents, value: pack.agents.filter((a) => a.status === 'PRODUCTION').length },
    { label: copy.home.counters.kpis, value: pack.kpis.length },
    { label: copy.home.counters.answered, value: answered },
  ];
  const domains = [...new Set(pack.agents.map((a) => a.domain))];
  const agentName = (id: string) => pack.agents.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="hero-h">
        <p className="text-sm text-muted-foreground">{pack.manifest.company.name}</p>
        <h1 id="hero-h" className="text-2xl font-semibold">
          {copy.home.heroLabel} {domains.join(', ')}
        </h1>
        <form action={`/${packId}/ask`} method="get" className="flex gap-2" role="search">
          <label htmlFor="hero-q" className="sr-only">
            {copy.home.heroPlaceholder}
          </label>
          <input id="hero-q" name="q" defaultValue={pack.manifest.home.heroQuestion} maxLength={500} placeholder={copy.home.heroPlaceholder} className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3" data-testid="hero-input" />
          <button type="submit" className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-5 font-medium text-primary-foreground" data-testid="hero-submit">
            <Search aria-hidden className="size-4" />
            {copy.home.heroSubmit}
          </button>
        </form>
      </section>

      <section aria-labelledby="tiles-h" className="flex flex-col gap-3">
        <h2 id="tiles-h" className="text-base font-semibold">
          {copy.home.tiles}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => {
            const kpi = pack.kpis.find((k) => k.id === t.kpiId);
            const range = kpi ? rangeKeyFor(kpi.window) : undefined;
            const href = `/${packId}/semantic/${t.view}?tab=playground&metric=${t.metric}${range ? `&range=${range}` : ''}`;
            return <KpiTileCard key={t.kpiId} tile={t} packId={packId} locale={pack.manifest.locale} currency={pack.manifest.currency} playgroundHref={href} />;
          })}
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Estate counters">
        {counters.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-surface p-4">
            <dt className="text-xs text-muted-foreground">{c.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums" data-testid="counter">
              {c.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {theatre.length > 0 && <AnswerTheatre items={theatre} packId={packId} />}
        <div className="flex flex-col gap-6">
          <section aria-labelledby="ticker-h" className="rounded-lg border border-border bg-surface p-4">
            <h2 id="ticker-h" className="mb-2 text-base font-semibold">
              {copy.home.ticker}
            </h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.home.tickerEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm" data-testid="ticker">
                {recent.map((r) => (
                  <li key={r.id} className="truncate">
                    <span className="font-medium text-agent">{agentName(r.agentId)}</span> · {copy.ask.kinds[r.kind as keyof typeof copy.ask.kinds] ?? r.kind} · {r.question}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="open-h" className="rounded-lg border border-border bg-surface p-4">
            <h2 id="open-h" className="mb-2 text-base font-semibold">
              {copy.home.openItems}
            </h2>
            <p className="text-sm text-muted-foreground">{copy.home.openItemsEmpty}</p>
          </section>
        </div>
      </div>

      <Constellation
        agents={pack.agents.map((a) => ({ id: a.id, name: a.name, hue: a.avatar.hue, products: a.products.map((p) => p.id), kpis: a.kpi_coverage.map((c) => pack.kpis.find((k) => k.id === c.kpi)?.name ?? c.kpi) }))}
        products={pack.products.map((p) => ({ id: p.id, name: p.name, certified: p.initial_status === 'CERTIFIED' }))}
      />
    </div>
  );
}
