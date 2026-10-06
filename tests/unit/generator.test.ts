import { describe, expect, it } from 'vitest';
import { SourceTable, type Pack } from '@/lib/packs/schema';
import { generateBronze, topoOrder } from '@/lib/warehouse/generate';

const parent = SourceTable.parse({
  name: 'PARENT',
  system: 'test',
  description: 'parents',
  key: 'pid',
  rows: { S: 10, M: 10, L: 10 },
  columns: [
    { name: 'pid', type: 'VARCHAR', gen: { seq: { prefix: 'P-', pad: 3 } } },
    { name: 'region', type: 'VARCHAR', gen: { choice: { values: ['North', 'South'] } } },
  ],
  plant: [{ id: 'P-TST-01', description: 'P-001 is South', where: { pid: 'P-001' }, adjust: { region: { set: 'South' } } }],
});

const child = SourceTable.parse({
  name: 'CHILD',
  system: 'test',
  description: 'children',
  key: 'cid',
  rows: { S: 500, M: 500, L: 500 },
  loaded_at_from: 'event_date',
  cdc_noise: { duplicate_updates_pct: 10, deletes_pct: 2, dirty_strings_pct: 20 },
  columns: [
    { name: 'cid', type: 'VARCHAR', gen: { seq: { prefix: 'C-', pad: 4 } } },
    { name: 'pid', type: 'VARCHAR', gen: { fk: { table: 'PARENT', column: 'pid', dist: 'sequential' } } },
    { name: 'region', type: 'VARCHAR', gen: { derive_from: { fk_column: 'pid', parent_column: 'region' } }, dirty: false },
    { name: 'event_date', type: 'DATE', gen: { date: { from: '2026-01-01', to: 'asOf' } } },
    { name: 'due_date', type: 'DATE', gen: { date_offset: { from_column: 'event_date', days: { min: 21, max: 21 } } } },
    { name: 'amount', type: 'DOUBLE', gen: { lognormal: { mu: 3, sigma: 0.5, min: 1, decimals: 2 } } },
    { name: 'fee', type: 'DOUBLE', gen: { formula: 'amount * 0.1', decimals: 2 } },
    { name: 'note', type: 'VARCHAR', gen: { template: '{cid} for {pid}' } },
    { name: 'flag', type: 'BOOLEAN', gen: { bernoulli: 0.5 } },
  ],
});

const pack = { manifest: { asOf: '2026-09-30', seed: 42 }, sources: [child, parent] } as unknown as Pack;

describe('bronze generator', () => {
  const [p, c] = generateBronze(pack, 'S');

  it('orders parents before children', () => {
    expect(topoOrder([child, parent]).map((t) => t.name)).toEqual(['PARENT', 'CHILD']);
  });

  it('applies plants and derives parent attributes through fk', () => {
    const regions = p?.data[1] ?? [];
    expect(regions[0]).toBe('South');
    const ci = (name: string) => child.columns.findIndex((x) => x.name === name);
    for (let i = 0; i < (c?.baseRows ?? 0); i++) {
      const pid = c?.data[ci('pid')]?.[i];
      expect(pid).toBe(`P-${String((i % 10) + 1).padStart(3, '0')}`);
      expect(c?.data[ci('region')]?.[i]).toBe(regions[i % 10]);
      expect(c?.data[ci('due_date')]?.[i]).toBe(Number(c?.data[ci('event_date')]?.[i]) + 21);
      expect(c?.data[ci('fee')]?.[i]).toBeCloseTo(Number(c?.data[ci('amount')]?.[i]) * 0.1, 1);
    }
  });

  it('adds CDC duplicates and tombstones after base rows, with load times capped at asOf', () => {
    expect(c?.baseRows).toBe(500);
    const ops = c?.ops ?? [];
    expect(ops.slice(0, 500).every((o) => o === 'I')).toBe(true);
    expect(ops.filter((o) => o === 'U').length).toBeGreaterThan(20);
    expect(ops.filter((o) => o === 'D').length).toBeGreaterThan(2);
    const asOfEnd = (Math.round(Date.UTC(2026, 8, 30) / 86_400_000) + 1) * 86_400 - 1;
    expect(Math.max(...(c?.loadedAt ?? []))).toBeLessThanOrEqual(asOfEnd);
  });

  it('dirties eligible strings but never keys or excluded columns', () => {
    const notes = (c?.data[7] ?? []) as string[];
    expect(notes.some((n) => n !== n.trim() || n === n.toUpperCase())).toBe(true);
    expect((c?.data[0] ?? []).every((k) => /^C-\d{4}$/.test(String(k)))).toBe(true);
  });

  it('is deterministic', () => {
    const again = generateBronze(pack, 'S');
    expect(JSON.stringify(again.map((t) => t.data))).toBe(JSON.stringify([p, c].map((t) => t?.data)));
  });
});
