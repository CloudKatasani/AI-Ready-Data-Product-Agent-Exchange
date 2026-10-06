import { PolicyChips } from '@/components/governance/policy-chips';
import { CodeBlock } from '@/components/ui/code-block';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { KNOCKOUT_LAYERS, type KnockoutLayer } from '@/lib/packs/schema';
import { knockout } from '@/lib/presenter/strategy';
import { activePrincipal } from '../../../_server/session';

const c = copy.strategy;
type SP = { off?: string | string[] };

export default async function KnockoutPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<SP> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const raw = Array.isArray(sp.off) ? sp.off : sp.off ? [sp.off] : [];
  const off = KNOCKOUT_LAYERS.filter((l) => raw.includes(l)) as KnockoutLayer[];
  const results = await knockout(packId, await activePrincipal(pack), off).catch(() => []);
  const fmt = new Intl.NumberFormat(pack.manifest.locale, { maximumFractionDigits: 2 });
  const metricOf = (view: string, metric: string) => pack.semantic.find((v) => v.name === view)?.metrics.find((m) => m.name === metric);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.knockout.title}</h1>
        <p className="text-muted-foreground">{c.knockout.intro}</p>
      </header>
      <form method="get" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3" data-testid="knockout-switches">
        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">{c.knockout.switches}</legend>
          {KNOCKOUT_LAYERS.map((l) => (
            <label key={l} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
              <input type="checkbox" name="off" value={l} defaultChecked={off.includes(l)} data-layer={l} />
              {c.layers[l]} off
            </label>
          ))}
        </fieldset>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="knockout-apply">
          {c.knockout.apply}
        </button>
        <a href={`/${packId}/why/knockout`} className="text-sm underline">
          {c.knockout.allOn}
        </a>
      </form>
      <ul className="grid gap-4 lg:grid-cols-2" data-testid="knockout-answers">
        {results.map((r) => {
          const a = pack.knockout.answers.find((x) => x.id === r.id);
          const m = a ? metricOf(a.query.view, r.metric) : undefined;
          const unit = m?.unit === '%' ? '%' : m?.unit ? ` ${m.unit}` : '';
          return (
            <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-answer={r.id} data-kpi={r.kpi} data-delta={r.deltaPct ?? ''} data-confidence={r.confidence}>
              <p className="font-medium">{r.question}</p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">{c.knockout.governed}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{r.baseline === null ? c.knockout.none : `${fmt.format(r.baseline)}${unit}`}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{c.knockout.now}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{r.value === null ? c.knockout.notComputable : `${fmt.format(r.value)}${unit}`}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{c.knockout.delta}</dt>
                  <dd className={`text-xl font-semibold tabular-nums ${r.deltaPct ? 'text-fail' : ''}`}>{r.deltaPct === null ? c.knockout.none : `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%`}</dd>
                </div>
              </dl>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-border px-2 py-0.5 font-medium">{c.confidence[r.confidence]}</span>
                {r.failures.map((f) => (
                  <span key={f.layer} className="rounded-full border border-fail/60 px-2 py-0.5" data-failure={f.type}>
                    {c.layers[f.layer]}: {c.failure[f.type]}
                  </span>
                ))}
              </p>
              {r.error && <p className="text-sm text-muted-foreground">{r.error.split('\n')[0]}</p>}
              {r.policies.length > 0 && <PolicyChips policies={r.policies.filter((p) => p.kind === 'knockout' || p.kind === 'rule')} />}
              {r.displaySql && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">{c.knockout.sql}</summary>
                  <CodeBlock code={r.displaySql} label={c.knockout.sql} />
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
