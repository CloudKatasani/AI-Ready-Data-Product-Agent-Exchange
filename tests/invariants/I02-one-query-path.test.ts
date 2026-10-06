import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QueryService } from '@/lib/query/query-service';
import { MemoryLog, pack, persona, rubrics, service, testWarehouse } from '../setup/query';

// CLAUDE.md §4.2 — One governed query path.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const src = files(join(process.cwd(), 'src'));
const rel = (f: string) => relative(process.cwd(), f);

describe('I02 one governed query path', () => {
  it('only src/lib/warehouse/duckdb.ts imports the DuckDB driver', () => {
    const importers = src.filter((f) => /from ['"]@duckdb\//.test(readFileSync(f, 'utf8'))).map(rel);
    expect(importers).toEqual(['src/lib/warehouse/duckdb.ts']);
  });

  it('only QueryService (and the build/validator tooling) opens warehouse connections', () => {
    const openers = src.filter((f) => /openWarehouseReadOnly|openDuckDb\(/.test(readFileSync(f, 'utf8'))).map(rel).sort();
    expect(openers).toEqual(['src/lib/query/connections.ts', 'src/lib/warehouse/build.ts', 'src/lib/warehouse/duckdb.ts']);
  });

  it('UI code never touches warehouse connections directly', () => {
    const ui = src.filter((f) => f.includes('/src/app/') || f.includes('/src/components/'));
    const offenders = ui.filter((f) => /warehouseFor|@\/lib\/warehouse/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('every QueryService.run() writes exactly one QueryLog row', async () => {
    const { qs, log } = await service();
    await qs.run({ kind: 'metric', query: { view: 'RELIABILITY', metrics: ['saidi'] }, purpose: 'kpi-tile' }, persona('B'));
    await qs.run({ kind: 'preview', fqn: 'CONFORMED_GOLD.FCT_OUTAGE', limit: 5 }, persona('B'));
    await qs.run({ kind: 'sql', sql: 'SELECT count(*) FROM CONFORMED_GOLD.FCT_OUTAGE', source: 'worksheet' }, persona('B'));
    expect(log.entries.map((e) => e.kind)).toEqual(['metric', 'preview', 'sql']);
    expect(log.entries.every((e) => e.policies.some((p) => p.kind === 'limit'))).toBe(true);
  });

  it('applies entitlements, row access and masking for the principal', async () => {
    const { qs } = await service();
    const r = await qs.run({ kind: 'preview', fqn: 'CURATED_SILVER.CUSTOMER', limit: 5 }, persona('C'));
    expect(r.policiesApplied.map((p) => p.kind)).toEqual(expect.arrayContaining(['entitlement', 'masking', 'limit']));
  });

  it('incident effects shadow affected objects while an incident is open (Phase 7)', async () => {
    const { qs } = await service();
    const t = pack.incidents.find((x) => x.kind === 'late_feed');
    if (!t) throw new Error('no late-feed template');
    const open = new QueryService({ pack, rubrics, warehouse: await testWarehouse(), log: new MemoryLog(), state: { appliedFixes: [], incidents: [t.id] } });
    const sql = { kind: 'sql' as const, sql: `SELECT count(*) FROM ${t.object}`, source: 'worksheet' as const };
    const base = await qs.run(sql, persona('D'));
    const shadowed = await open.run(sql, persona('D'));
    expect(shadowed.policiesApplied.some((p) => p.kind === 'incident' && p.ruleOrPolicyId === t.id)).toBe(true);
    expect(Number(shadowed.rows[0]?.[0])).toBeLessThan(Number(base.rows[0]?.[0]));
    for (const id of t.affects.products) expect(shadowed.sources.find((s) => s.productId === id)?.health ?? 'degraded').not.toBe('healthy');
    // Closed again (state without the incident): the base object is read unchanged.
    expect((await qs.run(sql, persona('D'))).rows).toEqual(base.rows);
  });
});
