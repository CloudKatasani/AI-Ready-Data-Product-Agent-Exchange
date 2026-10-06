/**
 * DQ engine (05 §5, 06 §2 Stage 8): runs a product's declared DQ rules through QueryService (as the
 * system principal, `source: 'dq-rule'`), scores them with the rubric's dimension weights and returns
 * rule results plus a 0–100 score. Persisting is the caller's job (QualityRuleResult, QualityScoreSnapshot).
 */
import { dqMetricSql, dqPasses } from '@/lib/packs/dq';
import type { DataProduct, DqRule, Pack, Rubrics } from '@/lib/packs/schema';
import { systemPrincipal } from '@/lib/query/principal';
import type { QueryService } from '@/lib/query/query-service';

export interface RuleResult {
  ruleId: string;
  dimension: string;
  passed: boolean;
  /** Share of rows that conform (rate metrics), else 1/0 from the assertion. */
  rowPassRate: number;
  observed: number | null;
  threshold: number;
  error?: string;
}

export interface QualityScore {
  score: number;
  dimensions: Record<string, { passRate: number; rules: number }>;
  tier: string;
  results: RuleResult[];
}

/** Every warehouse object a product reads or exposes (semantic tables, upstream, SQL ports). */
export function productObjects(pack: Pack, product: DataProduct): string[] {
  const view = product.semantic_view ? pack.semantic.find((v) => v.name === product.semantic_view) : undefined;
  return [...new Set([...product.upstream, ...(view?.tables.map((t) => t.fqn) ?? [])])].sort();
}

export function productRules(pack: Pack, product: DataProduct): DqRule[] {
  const objects = new Set(productObjects(pack, product));
  return pack.dq.filter((r) => objects.has(r.object));
}

export function tierFor(rubrics: Rubrics, score: number): string {
  const tiers = Object.entries(rubrics.quality.tiers).sort((a, b) => b[1] - a[1]);
  return tiers.find(([, min]) => score >= min)?.[0] ?? 'unrated';
}

/** Row-level pass rate for rate metrics (1 − null/dup/invalid rate; regex conformance), else the assertion. */
export function rowPassRate(metric: string, observed: number | null, passed: boolean): number {
  if (observed === null || !Number.isFinite(observed)) return 0;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  if (metric === 'null_rate' || metric === 'dup_rate' || metric === 'invalid_rate') return clamp(1 - observed);
  if (metric === 'regex_rate') return clamp(observed);
  return passed ? 1 : 0;
}

/** Weighted pass rate over the dimensions that have rules (weights renormalised), 0–100, one decimal. */
export function scoreResults(rubrics: Rubrics, results: RuleResult[]): Omit<QualityScore, 'results'> {
  const dims: Record<string, { pass: number; n: number }> = {};
  for (const r of results) {
    const d = (dims[r.dimension] ??= { pass: 0, n: 0 });
    d.n += 1;
    d.pass += r.rowPassRate;
  }
  let weighted = 0;
  let weights = 0;
  const dimensions: QualityScore['dimensions'] = {};
  for (const [name, d] of Object.entries(dims)) {
    const w = rubrics.quality.dimensions[name] ?? 0;
    const rate = d.n ? d.pass / d.n : 0;
    dimensions[name] = { passRate: Math.round(rate * 10000) / 100, rules: d.n };
    weighted += w * rate;
    weights += w;
  }
  const score = weights ? Math.round((weighted / weights) * 10000) / 100 : 0;
  return { score, dimensions, tier: tierFor(rubrics, score) };
}

export async function runProductQuality(pack: Pack, rubrics: Rubrics, qs: QueryService, product: DataProduct): Promise<QualityScore> {
  const who = systemPrincipal(pack);
  const results: RuleResult[] = [];
  for (const rule of productRules(pack, product)) {
    const spec = dqMetricSql(rule);
    try {
      const r = await qs.run({ kind: 'sql', sql: spec.sql, source: 'dq-rule' }, who);
      const v = r.rows[0]?.[0];
      const observed = typeof v === 'number' ? v : v === null || v === undefined ? null : Number(v);
      const passed = dqPasses(observed, spec.op, spec.threshold);
      results.push({ ruleId: rule.id, dimension: rule.dimension, passed, rowPassRate: rowPassRate(spec.metric, observed, passed), observed, threshold: spec.threshold });
    } catch (e) {
      results.push({ ruleId: rule.id, dimension: rule.dimension, passed: false, rowPassRate: 0, observed: null, threshold: spec.threshold, error: (e as Error).message });
    }
  }
  return { ...scoreResults(rubrics, results), results };
}
