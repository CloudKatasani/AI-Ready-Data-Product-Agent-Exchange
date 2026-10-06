import { QualityRing } from '@/components/marketplace/chips';
import { copy } from '@/copy/en';
import { productRules } from '@/lib/lifecycle/quality';
import type { DataProduct, DqRule, Pack } from '@/lib/packs/schema';
import { latestResultsForRules, latestRuleResults, qualityHistory } from '@/lib/presenter/marketplace';

type Result = { ruleId: string; observed: number | null; passed: boolean };

/** DQ rules with their latest observed value and verdict (rules without a run show "Not run yet"). */
export function RuleResultsTable({ rules, results, label }: { rules: DqRule[]; results: Map<string, Result>; label: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-md border border-border">
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
                    <span className="text-muted-foreground">{copy.product.notRun}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A product's data quality: score, per-dimension pass rates, score history and every rule's latest result. */
export async function ProductQuality({ pack, product, score }: { pack: Pack; product: DataProduct; score?: number | null }) {
  const rules = productRules(pack, product);
  if (rules.length === 0) return <p className="text-sm text-muted-foreground" data-testid="dq-empty">{copy.product.noQualityYet}</p>;
  const own = await latestRuleResults(product.id);
  // Rules this product has not run yet may have results from another product on the same objects.
  const missing = rules.map((r) => r.id).filter((id) => !own.some((x) => x.ruleId === id));
  const results = new Map<string, Result>([...(await latestResultsForRules(missing)), ...own].map((r) => [r.ruleId, r]));
  const history = await qualityHistory(product.id);
  const latest = history.at(-1);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <QualityRing score={score ?? latest?.score ?? null} size={88} />
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
      <RuleResultsTable rules={rules} results={results} label={copy.product.tabs.quality} />
    </div>
  );
}

/** Rules declared on one warehouse object, with their latest results across products. */
export async function ObjectQuality({ pack, fqn }: { pack: Pack; fqn: string }) {
  const rules = pack.dq.filter((d) => d.object === fqn);
  if (rules.length === 0) return <p className="text-sm text-muted-foreground" data-testid="dq-empty">{copy.explorer.noRules}</p>;
  const results = new Map<string, Result>((await latestResultsForRules(rules.map((r) => r.id))).map((r) => [r.ruleId, r]));
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">{copy.explorer.qualityLatest}</p>
      <RuleResultsTable rules={rules} results={results} label={copy.product.tabs.quality} />
    </div>
  );
}
