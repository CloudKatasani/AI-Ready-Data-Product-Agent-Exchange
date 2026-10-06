import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPack } from '@/lib/packs/registry';
import { openWarehouseReadOnly } from '@/lib/warehouse/build';
import { buildSnowflakeBundle, maskingFunctions, snowflakeColumn, snowflakeType } from '@/lib/warehouse/snowflake-deploy';

/** ADR-0025: a pack deploys to Snowflake as data — every built object, row-for-row. */
const pack = getPack('utilities');
const warehouse = process.env.KEYSTONE_TEST_WAREHOUSE ?? join(process.cwd(), 'data', 'test-warehouse', 'M', 'utilities.duckdb');
const out = join(process.cwd(), 'data', 'test-snowflake-bundle');

describe('Snowflake deploy bundle', () => {
  it('exports every warehouse object to Parquet with exactly the warehouse row counts, and renders deploy/verify SQL', async () => {
    const b = await buildSnowflakeBundle(pack, warehouse, out);
    const w = await openWarehouseReadOnly(warehouse);
    try {
      const objects = (await w.query("SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('RAW_BRONZE','CURATED_SILVER','CONFORMED_GOLD','SEMANTIC','GLOSSARY','CONTEXT','DATA_PRODUCTS','AGENTS','GOVERNANCE')")).rows[0]?.[0];
      expect(b.objects).toHaveLength(Number(objects));
      for (const o of b.objects) {
        expect(existsSync(join(out, o.file)), o.fqn).toBe(true);
        const n = (await w.query(`SELECT count(*) FROM ${o.fqn}`)).rows[0]?.[0];
        expect(o.rows, o.fqn).toBe(Number(n));
      }
    } finally {
      await w.close();
    }
    const deploy = readFileSync(join(out, 'deploy.sql'), 'utf8');
    for (const o of b.objects) {
      expect(deploy).toContain(`CREATE OR REPLACE TABLE ${o.fqn} (`);
      expect(deploy).toContain(`PUT file://data/${o.fqn}.parquet`);
      expect(deploy).toContain(`COPY INTO ${o.fqn} FROM`);
    }
    expect(deploy).toContain(`CREATE DATABASE IF NOT EXISTS ${pack.manifest.database};`);
    expect(deploy).toContain("GOVERNANCE.AS_OF() RETURNS DATE AS $$ DATE '2026-09-30' $$");
    expect(deploy).not.toMatch(/\bMACRO\b|HUGEINT|\bDOUBLE\b/);
    const verify = readFileSync(join(out, 'verify.sql'), 'utf8');
    expect(verify.match(/UNION ALL/g)?.length).toBe(b.objects.length - 1);
  });

  it('is deterministic: rebuilding gives byte-identical SQL and manifest', async () => {
    const read = () => ['deploy.sql', 'verify.sql', 'manifest.json'].map((f) => readFileSync(join(out, f), 'utf8'));
    await buildSnowflakeBundle(pack, warehouse, out);
    const first = read();
    await buildSnowflakeBundle(pack, warehouse, out);
    expect(read()).toEqual(first);
  });

  it('maps types and names safely', () => {
    expect(snowflakeType('BIGINT')).toBe('NUMBER(38,0)');
    expect(snowflakeType('HUGEINT')).toBe('NUMBER(38,0)');
    expect(snowflakeType('DECIMAL(18,2)')).toBe('NUMBER(18,2)');
    expect(snowflakeType('TIMESTAMP')).toBe('TIMESTAMP_NTZ');
    expect(() => snowflakeType('STRUCT(a INTEGER)')).toThrow();
    expect(snowflakeColumn('order')).toBe('"ORDER"');
    expect(snowflakeColumn('region')).toBe('region');
    expect(maskingFunctions().join('\n')).not.toMatch(/'g'\)/);
  });
});
