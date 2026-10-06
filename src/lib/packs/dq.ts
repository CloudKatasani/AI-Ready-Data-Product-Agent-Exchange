import type { DqRule } from './schema';

/** SQL that computes a DQ rule's observed metric (05 §5). Pure — executed via the warehouse by callers. */
export function dqMetricSql(rule: DqRule): { sql: string; metric: string; op: string; threshold: number } {
  const m = /^([a-z_]+)\s*(<=|>=|<|>|==)\s*(-?\d+(?:\.\d+)?)$/.exec(rule.assertion);
  if (!m) throw new Error(`${rule.id}: bad assertion "${rule.assertion}"`);
  const [, metric = '', op = '', threshold = '0'] = m;
  const col = rule.column ? `"${rule.column}"` : null;
  const need = (what: string): string => {
    if (!col) throw new Error(`${rule.id}: ${metric} needs a column`);
    return what;
  };
  const lit = (v: string | number | boolean) => (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v));
  let expr: string;
  switch (metric) {
    case 'null_rate':
      expr = need(`avg(CASE WHEN ${col} IS NULL THEN 1.0 ELSE 0.0 END)`);
      break;
    case 'distinct_ratio':
      expr = need(`count(DISTINCT ${col}) * 1.0 / nullif(count(*), 0)`);
      break;
    case 'dup_rate':
      expr = need(`1.0 - count(DISTINCT ${col}) * 1.0 / nullif(count(${col}), 0)`);
      break;
    case 'min':
      expr = need(`min(${col})`);
      break;
    case 'max':
      expr = need(`max(${col})`);
      break;
    case 'regex_rate':
      if (!rule.pattern) throw new Error(`${rule.id}: regex_rate needs a pattern`);
      expr = need(`avg(CASE WHEN ${col} IS NULL OR regexp_full_match(CAST(${col} AS VARCHAR), ${lit(rule.pattern)}) THEN 1.0 ELSE 0.0 END)`);
      break;
    case 'invalid_rate':
      if (!rule.allowed?.length) throw new Error(`${rule.id}: invalid_rate needs allowed values`);
      expr = need(`avg(CASE WHEN ${col} IS NULL OR ${col} IN (${rule.allowed.map(lit).join(', ')}) THEN 0.0 ELSE 1.0 END)`);
      break;
    case 'freshness_min':
      expr = `date_diff('minute', max(${col ?? 'loaded_at'}), CAST(GOVERNANCE.as_of() AS TIMESTAMP) + INTERVAL 1 DAY)`;
      break;
    case 'row_count':
      expr = 'count(*)';
      break;
    default:
      throw new Error(`${rule.id}: unknown metric ${metric}`);
  }
  return { sql: `SELECT CAST(${expr} AS DOUBLE) AS observed FROM ${rule.object}`, metric, op, threshold: Number(threshold) };
}

export function dqPasses(observed: number | null, op: string, threshold: number): boolean {
  if (observed === null || Number.isNaN(observed)) return false;
  switch (op) {
    case '<=':
      return observed <= threshold;
    case '>=':
      return observed >= threshold;
    case '<':
      return observed < threshold;
    case '>':
      return observed > threshold;
    default:
      return observed === threshold;
  }
}
