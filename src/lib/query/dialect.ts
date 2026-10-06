/**
 * Execution dialect (ADR-0025). The governed path compiles DuckDB SQL. When the active warehouse is
 * Snowflake, QueryService passes the final statement through `toSnowflakeSql()` before it runs.
 *
 * Only constructs the governed path actually emits are rewritten:
 * - metric expressions: `date_diff`, `quantile_cont`;
 * - incident overlays: `hash`, `INTERVAL (n) HOUR`;
 * - catalog queries: the information_schema name.
 *
 * Everything else the compiler, policies and packs' metric expressions use already means the same in both
 * dialects (SUM/AVG/COUNT_IF/NULLIF/MEDIAN/LEAST, DATE_TRUNC('unit', x), CAST, `SELECT * REPLACE/RENAME`).
 * Pack transforms never run on Snowflake: deploys load the built tables as data (snowflake-deploy.ts).
 * Bound `?` parameters and string literals are left untouched.
 */

/** Applies `fn` to the SQL outside single-quoted literals. */
function outsideLiterals(sql: string, fn: (code: string) => string): string {
  return sql
    .split(/('(?:[^']|'')*')/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join('');
}

/** DuckDB date_diff('day', a, b) → Snowflake DATEDIFF(day, a, b) (same argument order). */
function dateDiff(sql: string): string {
  return sql.replace(/\bdate_diff\(\s*'(\w+)'\s*,/gi, (_m, unit: string) => `DATEDIFF(${unit.toLowerCase()},`);
}

/** quantile_cont(x, p) → PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY x) (x is a quoted identifier or a column). */
function quantiles(code: string): string {
  return code.replace(/\bquantile_cont\(\s*("[^"]+"|[A-Za-z_][\w.]*)\s*,\s*([0-9.]+)\s*\)/g, 'PERCENTILE_CONT($2) WITHIN GROUP (ORDER BY $1)');
}

/** hash(x) is non-negative in DuckDB, signed in Snowflake: ABS(HASH(x)) keeps `% 100 < pct` a percentage. */
function hashes(code: string): string {
  return code.replace(/\bhash\(([^()]+)\)/g, 'ABS(HASH($1))');
}

/** DuckDB `INTERVAL (6) HOUR` → Snowflake `INTERVAL '6 HOUR'`. */
function intervals(code: string): string {
  return code.replace(/\bINTERVAL\s*\(\s*(\d+)\s*\)\s*(YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)S?\b/gi, (_m, n: string, unit: string) => `INTERVAL '${n} ${unit.toUpperCase()}'`);
}

export function toSnowflakeSql(sql: string): string {
  const code = (s: string) => intervals(hashes(quantiles(s)));
  // date_diff's unit is a literal, so it is rewritten before literals are protected.
  const rewritten = outsideLiterals(dateDiff(sql), code);
  // Snowflake reports the information schema in upper case.
  return rewritten.replace(/table_schema <> 'information_schema'/g, "table_schema <> 'INFORMATION_SCHEMA'");
}

/** DuckDB-only constructs that must not reach Snowflake (used by tests over every compiled pack query). */
export const DUCKDB_ONLY = [/\bdate_diff\(/i, /\bquantile_cont\(/i, /(?<!ABS\()\bhash\(/, /INTERVAL\s*\(/i, /\bstrftime\(/i, /\blist_\w+\(/i];
