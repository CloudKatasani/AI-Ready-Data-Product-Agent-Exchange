import { describe, expect, it } from 'vitest';
import { PolicyDenied } from '@/lib/query/types';
import { SqlRejected } from '@/lib/query/query-service';
import { persona, service } from '../setup/query';

const hero = { view: 'RELIABILITY', metrics: ['saidi'], dimensions: ['region'], timeRange: { last: { n: 1, unit: 'quarter' as const } } };

describe('QueryService — metric requests', () => {
  it('returns governed numbers with rules, sources, display SQL and one QueryLog row', async () => {
    const { qs, log } = await service();
    const r = await qs.run({ kind: 'metric', query: hero, purpose: 'playground' }, persona('B'));
    expect(r.rowCount).toBe(5);
    expect(r.ruleRefs).toEqual(['BR-UTL-012']);
    expect(r.sources.map((s) => s.productId)).toEqual(['DP-UTL-002']);
    expect(r.displaySql).toContain('NVE_AI_PLATFORM.CONFORMED_GOLD.FCT_OUTAGE');
    expect(r.displaySql).toContain('BUSINESS RULE BR-UTL-012');
    expect(r.displaySql).toContain("'2026-07-01'::DATE");
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]?.kind).toBe('metric');
  });

  it('row-filters persona A to their region and uses the regional denominator (AC4.3)', async () => {
    const { qs } = await service();
    const all = await qs.run({ kind: 'metric', query: hero, purpose: 'playground' }, persona('B'));
    const north = await qs.run({ kind: 'metric', query: { ...hero, dimensions: [] }, purpose: 'playground' }, persona('A'));
    expect(north.rowFiltered).toBe(true);
    expect(north.policiesApplied.some((p) => p.kind === 'row_access' && p.ruleOrPolicyId === 'RAP_REGION')).toBe(true);
    const northRow = all.rows.find((r) => r[0] === 'North');
    expect(north.rows[0]?.[0]).toBeCloseTo(Number(northRow?.[1]), 9);
  });

  it('skips a business rule when the question asks for it', async () => {
    const { qs } = await service();
    const r = await qs.run({ kind: 'metric', query: hero, purpose: 'agent', question: 'SAIDI by region including major event days' }, persona('B'));
    expect(r.ruleRefs).toEqual([]);
  });

  it('denies a product the persona is not entitled to, with a requestable product', async () => {
    const { qs, log } = await service();
    const q = { view: 'PROCUREMENT', metrics: ['total_spend'] };
    await expect(qs.run({ kind: 'metric', query: q, purpose: 'agent' }, persona('A'))).rejects.toMatchObject({ name: 'PolicyDenied', productId: 'DP-UTL-006', requestable: true });
    expect(log.entries).toHaveLength(0);
    const ok = await qs.run({ kind: 'metric', query: q, purpose: 'agent' }, persona('D'));
    expect(ok.policiesApplied.some((p) => p.kind === 'entitlement')).toBe(true);
  });

  it('masks PII dimensions in metric results for non-cleared personas, keeping one row per customer', async () => {
    const { qs } = await service();
    const q = { view: 'CUSTOMER_360', metrics: ['avg_churn_risk'], dimensions: ['customer_name'], limit: 5, orderBy: [{ field: 'avg_churn_risk', dir: 'desc' as const }] };
    const a = await qs.run({ kind: 'metric', query: q, purpose: 'agent' }, persona('A'));
    const d = await qs.run({ kind: 'metric', query: q, purpose: 'agent' }, persona('D'));
    expect(a.rowCount).toBe(5);
    expect(a.maskedColumns).toEqual(['customer_name']);
    expect(a.rows.every((r) => r[0] === '•••')).toBe(true);
    expect(d.maskedColumns).toEqual([]);
    expect(d.rows.every((r) => typeof r[0] === 'string' && r[0] !== '•••')).toBe(true);
  });
});

describe('QueryService — previews (AC8.1)', () => {
  it('shows masked values to persona B and clear values to persona D for the same object', async () => {
    const { qs } = await service();
    // B is not entitled to the Customer 360 product (Gold), but analysts may browse the Silver layer.
    const gold = await qs.run({ kind: 'preview', fqn: 'CONFORMED_GOLD.DIM_CUSTOMER', limit: 10 }, persona('B')).catch((e: unknown) => e);
    expect(gold).toBeInstanceOf(PolicyDenied);
    const c = await qs.run({ kind: 'preview', fqn: 'CURATED_SILVER.CUSTOMER', limit: 10 }, persona('B'));
    const d = await qs.run({ kind: 'preview', fqn: 'CURATED_SILVER.CUSTOMER', limit: 10 }, persona('D'));
    const col = c.columns.findIndex((x) => x.name === 'first_name');
    expect(c.maskedColumns).toEqual(expect.arrayContaining(['first_name', 'last_name', 'email', 'phone', 'street_address']));
    expect(c.rows.every((r) => r[col] === '•••')).toBe(true);
    expect(d.maskedColumns).toEqual([]);
    expect(d.rows.every((r) => r[col] !== '•••')).toBe(true);
    expect(c.rows.map((r) => r[0])).toEqual(d.rows.map((r) => r[0]));
  });

  it('keeps raw layers away from business consumers and executives', async () => {
    const { qs } = await service();
    await expect(qs.run({ kind: 'preview', fqn: 'RAW_BRONZE.CIS_CUSTOMER' }, persona('A'))).rejects.toBeInstanceOf(PolicyDenied);
    await expect(qs.run({ kind: 'preview', fqn: 'CONFORMED_GOLD.FCT_OUTAGE' }, persona('E'))).rejects.toMatchObject({ requestable: false });
  });
});

describe('QueryService — worksheet (AC8.2)', () => {
  it.each([
    ['DROP TABLE CONFORMED_GOLD.DIM_DATE', /Only read-only SELECT/],
    ["COPY CONFORMED_GOLD.DIM_DATE TO '/tmp/x.csv'", /Only read-only SELECT/],
    ["ATTACH '/tmp/x.db' AS x", /Only read-only SELECT/],
    ['SELECT 1; SELECT 2', /one statement/],
    ["SELECT * FROM read_csv('/etc/passwd')", /not allowed/],
    ["SELECT current_setting('threads')", /not allowed/],
    ["SELECT * FROM query('SELECT 1')", /not allowed/],
    ['SELECT * FROM DIM_DATE', /Qualify/],
    ['SELECT * FROM CONFORMED_GOLD.NOPE', /not an object/],
  ])('rejects %s without executing it', async (sql, msg) => {
    const { qs, log } = await service();
    const err = await qs.run({ kind: 'sql', sql, source: 'worksheet' }, persona('D')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SqlRejected);
    expect((err as Error).message).toMatch(msg);
    expect(log.entries).toHaveLength(0);
  });

  it('runs SELECTs with persona policies applied to every referenced table', async () => {
    const { qs } = await service();
    const sql = `WITH c AS (SELECT region, email FROM curated_silver.customer)
      SELECT c.region, count(*) AS n, min(c.email) AS sample_email FROM c GROUP BY 1 ORDER BY 1`;
    const b = await qs.run({ kind: 'sql', sql, source: 'worksheet' }, persona('B'));
    const d = await qs.run({ kind: 'sql', sql, source: 'worksheet' }, persona('D'));
    expect(b.maskedColumns).toContain('email');
    // MASK_EMAIL hashes the local part and keeps the domain.
    expect(String(b.rows[0]?.[2])).toMatch(/^[0-9a-f]{6}@examplemail\.com$/);
    expect(String(d.rows[0]?.[2])).toMatch(/^[a-z]+\.[a-z]+\d*@examplemail\.com$/);
    expect(b.rows.map((r) => r[1])).toEqual(d.rows.map((r) => r[1]));
  });

  it('row-filters worksheet queries for regional personas, with or without an alias', async () => {
    const { qs } = await service();
    const r = await qs.run({ kind: 'sql', sql: 'SELECT DISTINCT region FROM CONFORMED_GOLD.DIM_FEEDER', source: 'worksheet' }, persona('C'));
    expect(r.rows.length).toBe(5);
    const qualified = await qs
      .run({ kind: 'sql', sql: 'SELECT DIM_FEEDER.region, count(*) FROM CONFORMED_GOLD.DIM_FEEDER GROUP BY 1', source: 'worksheet' }, persona('B'))
      .catch((e: unknown) => e);
    expect(qualified).not.toBeInstanceOf(Error);
  });
});
