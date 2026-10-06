import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DraftError, draftPack, validateDraftInput } from '@/lib/packs/drafter';
import { getStories, packsDir } from '@/lib/packs/registry';
import { validatePackStatic } from '@/lib/packs/validate';

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const input = { id: 'water', name: 'Water utility', code: 'WTR', industry: 'Water & wastewater utility', company: { name: 'Clearbrook Water', short: 'CBW', hq: 'Millhaven', description: 'Regional water utility' }, regions: ['Upper Valley', 'Lower Valley', 'Coast', 'Hills', 'Metro'] };

describe('Pack Drafter (M13, offline re-skin)', () => {
  it('re-skins a deep pack into a draft that passes the static validator, with no trace of the source company', () => {
    const root = join(packsDir(), 'utilities');
    const files = Object.fromEntries(walk(root).map((f) => [relative(root, f), readFileSync(f, 'utf8')]));
    const out = draftPack(files, input);
    expect(out['golden.json']).toBeUndefined();
    const all = Object.values(out).join('\n');
    expect(all).not.toMatch(/Northvale|NVE_AI_PLATFORM|Ridgeport|-UTL-/);
    expect(all).toMatch(/DP-WTR-001/);
    expect(all).toMatch(/Upper Valley/);
    const dest = join(mkdtempSync(join(tmpdir(), 'keystone-draft-')), 'water');
    for (const [p, t] of Object.entries(out)) {
      mkdirSync(dirname(join(dest, p)), { recursive: true });
      writeFileSync(join(dest, p), t);
    }
    const { pack, report } = validatePackStatic(dest, getStories());
    expect(report.errors.map((e) => `${e.check}: ${e.message}`)).toEqual([]);
    expect(pack?.manifest.depth).toBe('draft');
    expect(pack?.manifest.company.name).toBe('Clearbrook Water');
    expect(pack?.manifest.lint_terms).toContain('Clearbrook');
  });

  it('rejects an existing id or a malformed code', () => {
    expect(() => validateDraftInput({ ...input, id: 'utilities' }, ['utilities'])).toThrow(DraftError);
    expect(() => validateDraftInput({ ...input, code: 'w1' }, [])).toThrow(/Code/);
  });
});
