import { describe, expect, it } from 'vitest';
import { checkWorksheetSql } from '@/lib/query/sql-safety';
import { persona, service, testWarehouse } from '../setup/query';

/**
 * 10 §1 security: 200 deterministic worksheet payloads — DDL/DML, multi-statements, file and network readers,
 * extensions, settings, catalog escapes — each wrapped in obfuscations. Every one must be rejected; known
 * good SELECTs must pass and still run through the governed path.
 */
const ATTACKS = [
  'DROP TABLE CONFORMED_GOLD.FCT_OUTAGE',
  'DELETE FROM CONFORMED_GOLD.FCT_OUTAGE',
  'UPDATE CONFORMED_GOLD.FCT_OUTAGE SET customer_minutes = 0',
  "INSERT INTO CONFORMED_GOLD.FCT_OUTAGE SELECT * FROM CONFORMED_GOLD.FCT_OUTAGE",
  'CREATE TABLE x AS SELECT 1',
  'ALTER TABLE CONFORMED_GOLD.FCT_OUTAGE ADD COLUMN x INT',
  "ATTACH '/tmp/evil.duckdb' AS evil",
  'DETACH DATABASE warehouse',
  "COPY CONFORMED_GOLD.FCT_OUTAGE TO '/tmp/out.csv'",
  "EXPORT DATABASE '/tmp/dump'",
  "INSTALL httpfs",
  "LOAD httpfs",
  "SET enable_external_access = true",
  "PRAGMA database_list",
  "CALL pragma_table_info('CONFORMED_GOLD.FCT_OUTAGE')",
  "SELECT * FROM read_csv('/etc/passwd')",
  "SELECT * FROM read_text('/etc/hostname')",
  "SELECT * FROM read_parquet('https://example.invalid/x.parquet')",
  "SELECT * FROM glob('/*')",
  "SELECT getenv('ANTHROPIC_API_KEY')",
  "SELECT current_setting('home_directory')",
  "SELECT * FROM duckdb_settings()",
  "SELECT * FROM information_schema.tables",
  "SELECT * FROM GOVERNANCE.UNKNOWN_OBJECT",
  "SELECT 1; DROP TABLE CONFORMED_GOLD.FCT_OUTAGE",
  "WITH x AS (DELETE FROM CONFORMED_GOLD.FCT_OUTAGE RETURNING *) SELECT * FROM x",
  "SELECT * FROM 'data/warehouse/utilities.duckdb'",
  "CHECKPOINT",
  "VACUUM",
  "BEGIN TRANSACTION",
  "SELECT * FROM sniff_csv('/etc/passwd')",
  "SELECT * FROM read_json_auto('/etc/passwd')",
  "SELECT * FROM duckdb_secrets()",
  "CREATE SECRET s (TYPE S3, KEY_ID 'x', SECRET 'y')",
  "SELECT * FROM range(1000000000)",
  "PREPARE p AS SELECT 1",
  "EXECUTE p",
  "DESCRIBE CONFORMED_GOLD.FCT_OUTAGE; DROP TABLE x",
  "SUMMARIZE CONFORMED_GOLD.FCT_OUTAGE",
  "SELECT * FROM pragma_storage_info('CONFORMED_GOLD.FCT_OUTAGE')",
];
const WRAP: ((s: string) => string)[] = [
  (s) => s,
  (s) => s.toLowerCase(),
  (s) => `  ${s}  ;`,
  (s) => `/* harmless */ ${s}`,
  (s) => `-- note\n${s}`,
];
const PAYLOADS = ATTACKS.flatMap((a) => WRAP.map((w) => w(a)));

describe('security — worksheet SQL fuzz', () => {
  it('has 200 payloads', () => expect(PAYLOADS).toHaveLength(200));

  it('rejects every one of them', async () => {
    const w = await testWarehouse();
    const { qs } = await service();
    const objects = await qs.objects();
    const accepted: string[] = [];
    for (const p of PAYLOADS) if ((await checkWorksheetSql(p, w, objects)).ok) accepted.push(p);
    expect(accepted).toEqual([]);
  });

  it('accepts ordinary SELECTs, which still run through policies', async () => {
    const { qs } = await service();
    const r = await qs.run({ kind: 'sql', sql: 'SELECT count(*) AS n FROM CONFORMED_GOLD.FCT_OUTAGE', source: 'worksheet' }, persona('B'));
    expect(r.policiesApplied.some((p) => p.kind === 'limit')).toBe(true);
    expect(Number(r.rows[0]?.[0])).toBeGreaterThan(0);
  });
});
