import Link from 'next/link';
import { ResultChart } from '@/components/charts/result-chart';
import { LinkTabs } from '@/components/explorer/tabs';
import { copy } from '@/copy/en';
import type { WhSize } from '@/lib/operate/cost';
import { getPack } from '@/lib/packs/registry';
import { costAndValue } from '@/lib/presenter/operate';

const c = copy.operate.cost;
type SP = { tab?: string; lag?: string; wh?: string; q?: string; price?: string };

const num = (v: string | undefined, min: number, max: number) => {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

export default async function CostValuePage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<SP> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const tab = sp.tab === 'value' ? 'value' : 'cost';
  const wh = (['XS', 'S', 'M', 'L'] as const).find((w) => w === sp.wh);
  const levers = { ...(num(sp.lag, 0.25, 8) !== undefined ? { lagFactor: num(sp.lag, 0.25, 8) } : {}), ...(wh ? { warehouse: wh as WhSize } : {}), ...(num(sp.q, 0, 100000) !== undefined ? { questionsPerDay: num(sp.q, 0, 100000) } : {}), ...(num(sp.price, 0.1, 50) !== undefined ? { creditPrice: num(sp.price, 0.1, 50) } : {}) };
  const { levers: lv, cost, value, liveActuals } = await costAndValue(packId, levers as Partial<typeof levers>);
  const usd = new Intl.NumberFormat(pack.manifest.locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = new Intl.NumberFormat(pack.manifest.locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 3 });
  const drivers = [...new Set(cost.items.map((i) => i.driver))].map((d) => ({ driver: d, usd: Math.round(cost.items.filter((i) => i.driver === d).reduce((a, i) => a + i.usd, 0)) }));
  const name = (id: string) => pack.products.find((p) => p.id === id)?.name ?? pack.agents.find((a) => a.id === id)?.name ?? id;
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== 'tab' && typeof v === 'string') as [string, string][]).toString();
  const field = 'h-9 rounded-md border border-border bg-surface px-2';
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
        <p className="text-xs text-muted-foreground">{c.illustrative}</p>
      </header>
      <LinkTabs label={c.title} active={tab} tabs={[{ id: 'cost', label: c.tabs.cost, href: `/${packId}/cost-value${qs ? `?${qs}` : ''}` }, { id: 'value', label: c.tabs.value, href: `/${packId}/cost-value?tab=value${qs ? `&${qs}` : ''}` }]} />

      {tab === 'cost' && (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3" aria-label={c.levers} data-testid="cost-levers">
            <label className="flex flex-col gap-1 text-sm">
              {c.lagFactor}
              <select name="lag" defaultValue={String(lv.lagFactor)} className={field}>
                {[0.25, 0.5, 1, 2, 4].map((v) => (
                  <option key={v} value={v}>
                    × {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {c.warehouse}
              <select name="wh" defaultValue={lv.warehouse} className={field}>
                {['XS', 'S', 'M', 'L'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {c.questions}
              <input name="q" type="number" min={0} defaultValue={lv.questionsPerDay} className={`${field} w-28`} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {c.creditPrice}
              <input name="price" type="number" step="0.1" min={0.1} defaultValue={lv.creditPrice} className={`${field} w-24`} />
            </label>
            <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="cost-apply">
              {c.apply}
            </button>
            <Link href={`/${packId}/cost-value`} className="h-9 rounded-md border border-border px-3 py-2 text-sm">
              {c.reset}
            </Link>
          </form>
          <p className="text-3xl font-semibold tabular-nums" data-testid="cost-total" data-value={Math.round(cost.total)}>
            {usd.format(cost.total)} <span className="text-base font-normal text-muted-foreground">/ month · {c.total}</span>
          </p>
          <ResultChart kind="bar" data={drivers} x="driver" y="usd" label={c.byDriver} unit="USD" />
          <div className="grid gap-4 xl:grid-cols-2">
            <section aria-labelledby="by-product">
              <h2 id="by-product" className="mb-2 font-semibold">{c.byProduct}</h2>
              <table className="w-full text-sm" data-testid="cost-by-product">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th scope="col">{copy.operate.health.product}</th>
                    <th scope="col">{c.byProduct}</th>
                    <th scope="col">{c.perConsumer}</th>
                    <th scope="col">{c.freshness} / {c.sla}</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.byProduct.map((p) => (
                    <tr key={p.productId} className="border-t border-border" data-product={p.productId} data-breach={p.breach}>
                      <th scope="row" className="py-1 text-left font-normal">{name(p.productId)}</th>
                      <td className="tabular-nums">{usd.format(p.usd)}</td>
                      <td className="tabular-nums">{usd.format(p.perConsumer)}</td>
                      <td className={p.breach ? 'font-medium text-fail' : ''}>
                        {p.freshnessMin} / {p.slaMin} min{p.breach ? ` · ${c.breach}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section aria-labelledby="by-agent">
              <h2 id="by-agent" className="mb-2 font-semibold">{c.byAgent}</h2>
              <table className="w-full text-sm" data-testid="cost-by-agent">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th scope="col">{copy.operate.quality.agent}</th>
                    <th scope="col">{c.byAgent}</th>
                    <th scope="col">{c.questions}</th>
                    <th scope="col">{c.perQuestion}</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.byAgent.map((a) => (
                    <tr key={a.agentId} className="border-t border-border">
                      <th scope="row" className="py-1 text-left font-normal">{name(a.agentId)}</th>
                      <td className="tabular-nums">{usd.format(a.usd)}</td>
                      <td className="tabular-nums">{a.questionsPerDay}</td>
                      <td className="tabular-nums">{usd2.format(a.perQuestion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-4 text-sm font-semibold">{c.live}</h3>
              {Object.keys(liveActuals).length === 0 ? (
                <p className="text-sm text-muted-foreground">{c.noLive}</p>
              ) : (
                <ul className="text-sm">
                  {Object.entries(liveActuals).map(([id, v]) => (
                    <li key={id}>
                      {name(id)}: {v.answers} answers · {v.tokens} tokens · {usd2.format(v.usd)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {tab === 'value' && (
        <section className="flex flex-col gap-3" data-testid="value-cases">
          <p className="text-lg" data-testid="value-portfolio">
            {c.portfolio}: {usd.format(value.annualValue)} {c.annual.toLowerCase()} · {usd.format(value.measuredValue)} {c.measured.toLowerCase()} · {usd.format(value.annualCost)} {c.annualCost.toLowerCase()}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col">{copy.operate.health.product}</th>
                <th scope="col">{c.hypothesis}</th>
                <th scope="col">{c.annual}</th>
                <th scope="col">{c.measured}</th>
                <th scope="col">{c.annualCost}</th>
                <th scope="col">{c.roi}</th>
              </tr>
            </thead>
            <tbody>
              {value.cases.map((v) => (
                <tr key={v.id} className="border-t border-border align-top" data-value-case={v.id}>
                  <th scope="row" className="py-2 pr-2 text-left font-medium">{name(v.productId)}</th>
                  <td className="py-2 pr-2">{v.hypothesis}</td>
                  <td className="tabular-nums">{usd.format(v.annual)}</td>
                  <td className="tabular-nums">{v.measured === null ? '—' : `${usd.format(v.measured)} (${v.confidence})`}</td>
                  <td className="tabular-nums">{usd.format(v.annualCost)}</td>
                  <td className="tabular-nums">{v.roi === null ? '—' : `${v.roi.toFixed(1)}×`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
