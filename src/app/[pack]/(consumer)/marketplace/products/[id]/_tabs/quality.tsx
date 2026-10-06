import { LineagePanelForId } from './lineage';
import { QualityRing } from '@/components/marketplace/chips';
import { copy } from '@/copy/en';
import { productRules } from '@/lib/lifecycle/quality';
import { latestRuleResults, qualityHistory } from '@/lib/presenter/marketplace';
import type { TabProps } from '.';

export async function QualityTab({ pack, product, card }: TabProps) {
  const rules = productRules(pack, product);
  const results = new Map((await latestRuleResults(product.id)).map((r) => [r.ruleId, r]));
  const history = await qualityHistory(product.id);
  const latest = history.at(-1);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <QualityRing score={card.quality?.score ?? null} size={88} />
        {latest && (
          <dl className="grid grid-cols-[10rem_auto] gap-x-4 gap-y-1 text-sm" data-testid="quality-dimensions">
            {Object.entries(latest.dimensions).map(([d, v]) => (
              <div key={d} className="contents">
                <dt className="capitalize text-muted-foreground">{d}</dt>
                <dd className="tabular-nums">
                  {v.passRate}% · {v.rules}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {history.length > 1 && (
          <p className="text-sm text-muted-foreground">
            {copy.product.scoreTrend}: {history.map((h) => h.score).join(' → ')}
          </p>
        )}
      </div>
      <div role="region" aria-label={copy.product.tabs.quality} tabIndex={0} className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm" data-testid="dq-rules">
          <thead className="bg-muted">
            <tr>
              {[copy.product.rule, copy.product.dimension, copy.product.assertion, copy.product.observed, copy.product.result].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const res = results.get(r.id);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-xs">{r.id}</span> {r.description}
                  </td>
                  <td className="px-3 py-1.5 capitalize">{r.dimension}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {r.object.split('.')[1]}
                    {r.column ? `.${r.column}` : ''}: {r.assertion}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{res?.observed === null || res === undefined ? '—' : Number(res.observed.toPrecision(4))}</td>
                  <td className="px-3 py-1.5 font-medium" data-passed={res?.passed}>
                    {res ? (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden className={`size-2 rounded-full ${res.passed ? 'bg-certified' : 'bg-fail'}`} />
                        {res.passed ? copy.product.pass : copy.product.fail}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LineageTab({ pack, product }: TabProps) {
  return <LineagePanelForId pack={pack} id={product.id} />;
}
