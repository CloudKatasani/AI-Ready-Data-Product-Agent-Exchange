import Link from 'next/link';
import { ResultChart } from '@/components/charts/result-chart';
import { OutcomeCard } from '@/components/governance/outcome-card';
import { PolicyChips } from '@/components/governance/policy-chips';
import { buttonVariants } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';
import { DataGrid } from '@/components/ui/data-grid';
import { copy } from '@/copy/en';
import type { Pack, SemanticView } from '@/lib/packs/schema';
import { type PlaygroundParams, playgroundQuery } from '@/lib/presenter/playground';
import { governedQuery } from '@/lib/presenter/governed';

export type { PlaygroundParams };
import type { Principal } from '@/lib/query/types';

const select = 'rounded-md border border-border bg-surface px-2 py-1.5 text-sm';

/** Semantic Playground (01 §M9): GET form → compiled MetricQuery → QueryService. Same path as agents. */
export async function Playground({ pack, view, params, who }: { pack: Pack; view: SemanticView; params: PlaygroundParams; who: Principal }) {
  const id = pack.manifest.id;
  const q = playgroundQuery(view, params);
  const out = q ? await governedQuery(id, { kind: 'metric', query: q, purpose: 'playground' }, who) : null;
  const metric = view.metrics.find((m) => m.name === q?.metrics[0]);
  const dim = view.dimensions.find((d) => d.name === q?.dimensions?.[0]);
  const question = metric ? `${metric.label}${dim ? ` by ${(dim.label ?? dim.name).toLowerCase()}` : ''}${params.range && params.range !== 'none' ? ` ${copy.semantic.ranges[params.range as keyof typeof copy.semantic.ranges]?.toLowerCase() ?? ''}` : ''}` : '';
  return (
    <div className="flex flex-col gap-5" data-testid="playground">
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label={copy.semantic.tabs.playground}>
        <input type="hidden" name="tab" value="playground" />
        <label className="flex flex-col gap-1 text-sm">
          {copy.semantic.metric}
          <select name="metric" defaultValue={params.metric ?? ''} className={select}>
            <option value="">—</option>
            {view.metrics.map((m) => (
              <option key={m.name} value={m.name}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.semantic.by}
          <select name="dim" defaultValue={params.dim ?? ''} className={select}>
            <option value="">{copy.semantic.none}</option>
            {view.dimensions.map((d) => (
              <option key={d.name} value={d.name}>
                {d.label ?? d.name}
              </option>
            ))}
          </select>
        </label>
        {view.time_dimensions.length > 0 && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              {copy.semantic.grain}
              <select name="grain" defaultValue={params.grain ?? ''} className={select}>
                <option value="">{copy.semantic.none}</option>
                {['day', 'week', 'month', 'quarter', 'year'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {copy.semantic.range}
              <select name="range" defaultValue={params.range ?? 'none'} className={select}>
                {Object.entries(copy.semantic.ranges).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-sm">
          {copy.semantic.filter}
          <select name="fdim" defaultValue={params.fdim ?? ''} className={select}>
            <option value="">{copy.semantic.none}</option>
            {view.dimensions.map((d) => (
              <option key={d.name} value={d.name}>
                {d.label ?? d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.semantic.value}
          <input name="fval" defaultValue={params.fval ?? ''} className={select} />
        </label>
        <button type="submit" className={buttonVariants()} data-testid="playground-run">
          {copy.semantic.runQuery}
        </button>
      </form>

      {!q && <p className="text-muted-foreground">{copy.semantic.pickMetric}</p>}
      {out && !out.ok && <OutcomeCard outcome={out} pack={id} />}
      {out?.ok && metric && (
        <div className="flex flex-col gap-4">
          {out.result.rowCount === 1 && out.result.columns.length === 1 && (
            <p className="text-4xl font-semibold tabular-nums" data-testid="playground-value" data-value={String(out.result.rows[0]?.[0] ?? '')}>
              {new Intl.NumberFormat(pack.manifest.locale, { maximumFractionDigits: metric.decimals, minimumFractionDigits: metric.decimals }).format(Number(out.result.rows[0]?.[0]))}{' '}
              <span className="text-lg font-normal text-muted-foreground">{metric.unit}</span>
            </p>
          )}
          {(dim || q?.timeGrain) && (
            <ResultChart
              kind={q?.timeGrain ? 'line' : 'bar'}
              x={q?.timeGrain ? 'period' : (dim?.name ?? '')}
              y={metric.name}
              unit={metric.unit}
              label={question}
              data={out.result.rows.map((r) => Object.fromEntries(out.result.columns.map((c, i) => [c.name, (r[i] as string | number | null) ?? null])))}
            />
          )}
          <DataGrid columns={out.result.fields} rows={out.result.rows} masked={out.result.maskedColumns} locale={pack.manifest.locale} caption={question} />
          {out.result.ruleRefs.length > 0 && (
            <p className="text-sm">
              {copy.semantic.rulesApplied}: {out.result.ruleRefs.map((r) => `${r} — ${pack.rules.find((x) => x.id === r)?.text ?? ''}`).join('; ')}
            </p>
          )}
          <PolicyChips policies={out.result.policiesApplied} />
          <section>
            <h3 className="mb-2 text-sm font-semibold">{copy.semantic.generatedSql}</h3>
            <CodeBlock code={out.result.displaySql} label={copy.semantic.generatedSql} />
          </section>
          <div>
            <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/${id}/ask?q=${encodeURIComponent(question)}`}>
              {copy.semantic.askAgent}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
