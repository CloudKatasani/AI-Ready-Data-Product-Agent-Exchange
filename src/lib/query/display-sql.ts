import type { CellValue } from '@/lib/warehouse/adapter';
import type { PolicyApplication } from './types';

const SCHEMAS = 'RAW_BRONZE|CURATED_SILVER|CONFORMED_GOLD|SEMANTIC|GLOSSARY|CONTEXT|DATA_PRODUCTS|AGENTS|GOVERNANCE';

/** Renders a SQL literal for display (never executed). */
export function displayLiteral(v: CellValue): string {
  if (v === null) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

/** Replaces positional `?` (outside string literals) with display literals. */
export function inlineParams(sql: string, params: CellValue[]): string {
  let i = 0;
  let out = '';
  let inString = false;
  for (const ch of sql) {
    if (ch === "'") inString = !inString;
    if (ch === '?' && !inString) out += displayLiteral(params[i++] ?? null);
    else out += ch;
  }
  return out;
}

/**
 * Snowflake-dialect rendering of the logical (pre-policy) query for screens and exports (05 §4).
 * Policies appear as comments, the way Snowflake attaches them to objects rather than queries.
 */
export function toDisplaySql(sql: string, params: CellValue[], database: string, policies: PolicyApplication[] = []): string {
  let s = inlineParams(sql, params);
  s = s.replace(/CAST\(('[^']*') AS DATE\)/g, '$1::DATE');
  s = s.replace(/date_trunc\('(\w+)'/g, (_m, g: string) => `DATE_TRUNC('${g.toUpperCase()}'`);
  s = s.replace(/quantile_cont\(([^,]+), ([0-9.]+)\)/g, 'PERCENTILE_CONT($2) WITHIN GROUP (ORDER BY $1)');
  s = s.replace(/\bcount_if\(/gi, 'COUNT_IF(').replace(/\bnullif\(/g, 'NULLIF(').replace(/\bsum\(/g, 'SUM(');
  s = s.replace(new RegExp(`(?<![A-Z_.])(${SCHEMAS})\\.([A-Z][A-Z0-9_]*)`, 'g'), `${database}.$1.$2`);
  const notes = policies
    .filter((p) => p.kind === 'row_access' || p.kind === 'masking' || p.kind === 'rule' || p.kind === 'incident')
    .map((p) => {
      if (p.kind === 'row_access') return `-- ROW ACCESS POLICY ${p.ruleOrPolicyId ?? ''} applied: ${p.detail}`;
      if (p.kind === 'masking') return `-- MASKING POLICY ${p.ruleOrPolicyId ?? ''} on ${p.target}`;
      if (p.kind === 'rule') return `-- BUSINESS RULE ${p.ruleOrPolicyId ?? ''}: ${p.detail}`;
      return `-- INCIDENT ${p.ruleOrPolicyId ?? ''}: ${p.detail}`;
    });
  return [...new Set(notes), s].join('\n');
}
