import Link from 'next/link';
import { OverrideForm } from '@/components/strategy/override-form';
import { copy } from '@/copy/en';
import { PHASES } from '@/lib/lifecycle/stages';
import { getPack } from '@/lib/packs/registry';
import { maturity, portfolio } from '@/lib/presenter/strategy';
import { maturityLevelLabel } from '@/lib/strategy/maturity';
import { overrideAction } from '../actions';

const c = copy.strategy.portfolio;

export default async function PortfolioPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<{ model?: string }> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const model = sp.model === 'RICE' ? 'RICE' : 'WSJF';
  const [rows, mat] = await Promise.all([portfolio(packId, model).catch(() => []), maturity(packId).catch(() => null)]);
  const usd = new Intl.NumberFormat(pack.manifest.locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </header>
      <section aria-labelledby="pipe-h">
        <h2 id="pipe-h" className="mb-2 font-semibold">{c.pipeline}</h2>
        <ol className="grid gap-2 sm:grid-cols-5" data-testid="portfolio-pipeline">
          {PHASES.map((ph) => {
            const inPhase = rows.filter((r) => r.phase === ph);
            return (
              <li key={ph} className="rounded-lg border border-border bg-surface p-3" data-phase={ph}>
                <p className="text-sm font-semibold">
                  {ph} <span className="text-muted-foreground">({inPhase.length})</span>
                </p>
                <ul className="mt-1 flex flex-col gap-1 text-xs">
                  {inPhase.map((r) => (
                    <li key={r.item.id}>
                      <Link href={`/${packId}/studio/${r.item.id}`} className="inline-block min-h-6 py-0.5 underline">
                        {r.item.product.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
      <section aria-labelledby="rank-h" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="rank-h" className="font-semibold">{c.ranking}</h2>
          <nav aria-label={c.model} className="flex gap-2 text-sm">
            {(['WSJF', 'RICE'] as const).map((m) => (
              <Link key={m} href={`/${packId}/portfolio?model=${m}`} aria-current={m === model ? 'page' : undefined} className={`rounded-full border px-3 py-0.5 ${m === model ? 'border-primary font-semibold' : 'border-border'}`}>
                {m}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs text-muted-foreground">{c.sizing}</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm" data-testid="portfolio-ranking">
            <caption className="sr-only">{c.ranking}</caption>
            <thead className="bg-muted text-left">
              <tr>
                {[c.rank, c.product, c.phase, c.score, c.why, c.cost, c.adoption, c.value].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item.id} className="border-t border-border align-top" data-product={r.item.id} data-rank={r.rank}>
                  <td className="px-3 py-2 tabular-nums">{r.rank}</td>
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {r.item.product.name} <span className="text-xs text-muted-foreground">{r.status.toLowerCase().replace('_', ' ')}</span>
                  </th>
                  <td className="px-3 py-2">{r.phase}</td>
                  <td className="px-3 py-2 tabular-nums">
                    <span className="font-semibold">{r.final}</span>
                    {r.override && <span className="block text-xs text-degraded">{c.overridden(r.override.by, r.override.reason)}</span>}
                    <OverrideForm action={overrideAction.bind(null, packId, r.item.id, model)} current={r.final} testId={`override-${r.item.id}`} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.model.explanation}</td>
                  <td className="px-3 py-2 tabular-nums">{usd.format(r.monthlyCost)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.adoption}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.valueExpected === null ? '—' : usd.format(r.valueExpected)} / {r.valueRealised === null ? '—' : usd.format(r.valueRealised)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {mat && (
        <section aria-labelledby="mat-h" className="flex flex-col gap-2">
          <h2 id="mat-h" className="font-semibold">
            {c.maturity} — {mat.overall.toFixed(1)} / 5
          </h2>
          <p className="text-sm text-muted-foreground">{c.maturityIntro}</p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="maturity">
            {mat.levels.map((l) => (
              <li key={l.key} className="rounded-lg border border-border bg-surface p-3 text-sm" data-dimension={l.key} data-level={l.level}>
                <p className="font-semibold">
                  {l.name}: {l.level} · {maturityLevelLabel(l.level)}
                </p>
                <p className="text-muted-foreground">{l.description}</p>
                <p className="mt-1 text-xs">
                  {c.evidence}: {l.evidence}% · {c.next}: {l.nextMove}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
