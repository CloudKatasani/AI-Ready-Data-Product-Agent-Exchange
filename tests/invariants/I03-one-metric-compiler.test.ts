import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileMetricQuery } from '@/lib/query/compiler';
import { pack, persona, service } from '../setup/query';

// CLAUDE.md §4.3 — One metric compiler.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('I03 one metric compiler', () => {
  it('compileMetricQuery() is the only producer of aggregate (GROUP BY) SQL in src/', () => {
    // SQL is built in template literals; keyword lists for highlighting are plain strings and don't count.
    const producers = files(join(process.cwd(), 'src'))
      .filter((f) => /`[^`]*GROUP BY[^`]*`/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(process.cwd(), f));
    expect(producers).toEqual(['src/lib/query/compiler.ts']);
  });

  it('every pack metric compiles, and the same MetricQuery always yields byte-identical SQL', () => {
    for (const v of pack.semantic) {
      for (const m of v.metrics) {
        const q = { view: v.name, metrics: [m.name] };
        const a = compileMetricQuery(q, pack);
        const b = compileMetricQuery(structuredClone(q), pack);
        expect(a.sql).toBe(b.sql);
        expect(a.params).toEqual(b.params);
      }
    }
  });

  it('KPI tile, playground and agent purposes return the same number for the same question', async () => {
    const { qs } = await service();
    const q = { view: 'RELIABILITY', metrics: ['saidi'], timeRange: { ytd: true } };
    const values = await Promise.all(
      (['kpi-tile', 'playground', 'agent', 'eval'] as const).map(async (purpose) => (await qs.run({ kind: 'metric', query: q, purpose }, persona('B'))).rows[0]?.[0]),
    );
    expect(new Set(values).size).toBe(1);
  });
});
