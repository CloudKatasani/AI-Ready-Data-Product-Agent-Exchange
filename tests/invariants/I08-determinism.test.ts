import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPack, listPackIds } from '@/lib/packs/registry';
import { generateBronze } from '@/lib/warehouse/generate';
import { buildWarehouse } from '@/lib/warehouse/build';

// CLAUDE.md §4.8 — Same pack + seed + scale ⇒ identical warehouse content.
const ENGINE_DIRS = ['warehouse', 'query', 'agents/scripted', 'strategy'].map((d) => join(process.cwd(), 'src/lib', d));

function files(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
    });
  } catch {
    return [];
  }
}

describe('I08 determinism', () => {
  it('no Math.random / Date.now / argument-less new Date() in engine code', () => {
    const offenders = ENGINE_DIRS.flatMap(files).filter((f) => /Math\.random\(|Date\.now\(|new Date\(\s*\)/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it.each(listPackIds())('%s: Bronze generation is identical across runs', (id) => {
    const pack = getPack(id);
    const a = generateBronze(pack, 'S');
    const b = generateBronze(pack, 'S');
    expect(a.map((t) => JSON.stringify([t.data, t.ops, t.loadedAt]))).toEqual(b.map((t) => JSON.stringify([t.data, t.ops, t.loadedAt])));
  });

  it.each(listPackIds())(
    '%s: two warehouse builds produce identical per-table checksums',
    async (id) => {
      const pack = getPack(id);
      const dir = mkdtempSync(join(tmpdir(), 'keystone-i08-'));
      const a = await buildWarehouse(pack, { scale: 'S', outDir: dir, path: join(dir, 'a.duckdb') });
      const b = await buildWarehouse(pack, { scale: 'S', outDir: dir, path: join(dir, 'b.duckdb') });
      expect(Object.keys(a.checksums).length).toBeGreaterThan(40);
      expect(b.checksums).toEqual(a.checksums);
    },
    120_000,
  );

  it.todo('scripted answers for every golden scenario are byte-identical across runs (Phase 3)');
});
