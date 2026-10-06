import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeGolden, diffGolden, type GoldenFile } from '@/lib/agents/golden';
import { getPack, getRubrics, listPackIds, packsDir } from '@/lib/packs/registry';
import { QueryService } from '@/lib/query/query-service';
import type { CellValue, QueryOptions, WarehouseAdapter } from '@/lib/warehouse/adapter';
import { openWarehouseReadOnly } from '@/lib/warehouse/build';

/**
 * ADR-0025 golden agreement, offline. A stand-in Snowflake warehouse receives exactly what QueryService
 * sends Snowflake (the translated dialect) and runs it on the DuckDB warehouse. DuckDB understands
 * PERCENTILE_CONT … WITHIN GROUP, ABS(HASH()) and INTERVAL 'n UNIT' natively; only Snowflake's unquoted
 * DATEDIFF unit is re-quoted. Every golden answer of every pack must come out unchanged, which shows the
 * translation preserves the numbers, not just the syntax.
 */
class SnowflakeOnDuckDb implements WarehouseAdapter {
  readonly dialect = 'snowflake' as const;
  readonly seen: string[] = [];
  constructor(private readonly inner: WarehouseAdapter) {}
  query(sql: string, params?: CellValue[], opts?: QueryOptions) {
    this.seen.push(sql);
    return this.inner.query(sql.replace(/\bDATEDIFF\((\w+),/g, "date_diff('$1',"), params, opts);
  }
  describe(fqn: string) {
    return this.inner.describe(fqn);
  }
  close() {
    return this.inner.close();
  }
}

const dir = process.env.KEYSTONE_GOLDEN_WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'test-warehouse', 'M');
const packs = listPackIds().filter((id) => {
  try {
    return getPack(id).scenarios.length > 0 && existsSync(join(dir, `${id}.duckdb`)) && existsSync(join(packsDir(), id, 'golden.json'));
  } catch {
    return false;
  }
});

describe('Snowflake golden agreement (translated SQL, offline)', () => {
  const seen: string[] = [];
  it.each(packs)('%s: every golden answer is unchanged through the Snowflake code path', async (id) => {
    const pack = getPack(id);
    const w = new SnowflakeOnDuckDb(await openWarehouseReadOnly(join(dir, `${id}.duckdb`)));
    try {
      const qs = new QueryService({ pack, rubrics: getRubrics(), warehouse: w, log: { write: async () => 'agreement' } });
      const actual = await computeGolden(pack, getRubrics(), qs, 'M');
      const expected = JSON.parse(readFileSync(join(packsDir(), id, 'golden.json'), 'utf8')) as GoldenFile;
      expect(diffGolden(expected, actual)).toEqual([]);
      seen.push(...w.seen);
    } finally {
      await w.close();
    }
  });

  it('the run really exercised the translations', () => {
    expect(packs.length).toBeGreaterThanOrEqual(11);
    expect(seen.some((s) => s.includes('PERCENTILE_CONT(') || s.includes('DATEDIFF('))).toBe(true);
    expect(seen.some((s) => /\bdate_diff\(|\bquantile_cont\(/.test(s))).toBe(false);
  });
});
