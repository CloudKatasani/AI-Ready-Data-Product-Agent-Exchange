import { describe, expect, it } from 'vitest';
import { getPack, listPackIds } from '@/lib/packs/registry';
import type { MetricQuery } from '@/lib/packs/schema';
import { compileMetricQuery } from '@/lib/query/compiler';
import { DUCKDB_ONLY, toSnowflakeSql } from '@/lib/query/dialect';
import { incidentSource } from '@/lib/query/incidents';

/** ADR-0025: governed SQL reaches Snowflake with no DuckDB-only constructs. */
const packs = listPackIds().flatMap((id) => {
  try {
    return [getPack(id)];
  } catch {
    return [];
  }
});

describe('Snowflake execution dialect', () => {
  it('rewrites each DuckDB-only construct the governed path emits', () => {
    expect(toSnowflakeSql("SELECT date_diff('day', a.opened, a.closed) FROM t a")).toBe('SELECT DATEDIFF(day, a.opened, a.closed) FROM t a');
    expect(toSnowflakeSql('SELECT quantile_cont("mttr", 0.9) AS "p90" FROM d')).toBe('SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY "mttr") AS "p90" FROM d');
    expect(toSnowflakeSql('WHERE hash("id") % 100 < 15')).toBe('WHERE ABS(HASH("id")) % 100 < 15');
    expect(toSnowflakeSql('WHERE ts <= (SELECT max(ts) FROM x) - INTERVAL (6) HOUR')).toBe("WHERE ts <= (SELECT max(ts) FROM x) - INTERVAL '6 HOUR'");
    expect(toSnowflakeSql("WHERE table_schema <> 'information_schema'")).toBe("WHERE table_schema <> 'INFORMATION_SCHEMA'");
    // Literals and bound parameters are left alone.
    expect(toSnowflakeSql("SELECT 'hash(x) INTERVAL (1) DAY' AS s WHERE r = ?")).toBe("SELECT 'hash(x) INTERVAL (1) DAY' AS s WHERE r = ?");
  });

  it('every metric of every pack compiles to Snowflake-clean SQL (value, by dimension, trend, distribution)', () => {
    let checked = 0;
    for (const pack of packs) {
      for (const view of pack.semantic) {
        const dim = view.dimensions[0]?.name;
        for (const m of view.metrics) {
          const queries: MetricQuery[] = [
            { view: view.name, metrics: [m.name] },
            { view: view.name, metrics: [m.name], timeRange: { last: { n: 1, unit: 'quarter' } } },
            ...(dim ? [{ view: view.name, metrics: [m.name], dimensions: [dim] }, { view: view.name, metrics: [m.name], dimensions: [dim], analysis: 'distribution' as const }] : []),
          ];
          for (const q of queries) {
            let sql: string;
            try {
              sql = compileMetricQuery(q, pack).sql;
            } catch {
              continue; // shapes a metric does not support are refused by the compiler, not sent anywhere
            }
            const out = toSnowflakeSql(sql);
            const leftovers = DUCKDB_ONLY.filter((re) => re.test(out)).map(String);
            expect(leftovers, `${pack.manifest.id} ${view.name}.${m.name}`).toEqual([]);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('incident overlays translate too (late feed, null spike, duplicate load)', () => {
    const cols = [
      { name: 'id', type: 'VARCHAR', nullable: false },
      { name: 'loaded_at', type: 'TIMESTAMP', nullable: true },
      { name: 'value', type: 'DOUBLE', nullable: true },
    ];
    const base = { object: 'CONFORMED_GOLD.FCT_X', affects: { products: [], agents: [] }, title: 't', severity: 'SEV2' as const };
    const templates = [
      { ...base, id: 'I1', kind: 'late_feed' as const, column: 'loaded_at', params: { lag_hours: 6 } },
      { ...base, id: 'I2', kind: 'null_spike' as const, column: 'value', params: { null_pct: 15 } },
      { ...base, id: 'I3', kind: 'duplicate_load' as const, params: { duplicate_pct: 10 } },
    ];
    const { sql } = incidentSource('CONFORMED_GOLD.FCT_X', 'CONFORMED_GOLD.FCT_X', cols, templates as never);
    const out = toSnowflakeSql(sql);
    expect(DUCKDB_ONLY.filter((re) => re.test(out)).map(String)).toEqual([]);
    expect(out).toContain("INTERVAL '6 HOUR'");
    expect(out).toContain('ABS(HASH("id"))');
  });
});
