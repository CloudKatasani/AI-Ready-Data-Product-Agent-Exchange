import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listPackIds, packsDir } from '@/lib/packs/registry';
import { extractTerms, scan } from '../../scripts/lint/no-domain-strings';

// CLAUDE.md §4.1 — Pack-driven, engine-generic.
const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx|css)$/.test(name) ? [p] : [];
  });
}

const terms = listPackIds().flatMap((id) => extractTerms(join(packsDir(), id)));

describe('I01 pack-driven, engine-generic', () => {
  it('every installed pack contributes domain terms to the lint', () => {
    for (const id of listPackIds()) expect(extractTerms(join(packsDir(), id)).length, id).toBeGreaterThan(20);
  });

  it('no term from any installed pack appears in src/', () => {
    const violations = scan(terms, sourceFiles(SRC));
    expect(violations.map((v) => `${v.file}:${v.line} ${v.term}`)).toEqual([]);
  });

  it('the lint fails when a pack term is planted in a source file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'keystone-i01-'));
    const file = join(dir, 'planted.tsx');
    const planted = terms.find((t) => /^[A-Za-z][A-Za-z ]+$/.test(t)) ?? 'Planted Term';
    writeFileSync(file, `export const label = '${planted}';\n`);
    expect(scan(terms.length ? terms : [planted], [file])).toHaveLength(1);
  });

  it('every UI module reads industry content through getPack(), never from pack files or literal pack ids', () => {
    const ui = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? ui(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const sources = [...ui(join(process.cwd(), 'src', 'app')), ...ui(join(process.cwd(), 'src', 'components'))];
    const packIds = listPackIds();
    const offenders = sources.filter((f) => {
      const t = readFileSync(f, 'utf8');
      return /from ['"](node:)?fs['"]/.test(t) && /packs/.test(t) || packIds.some((id) => new RegExp(`['"\`]/?${id}[/'"\`]`).test(t));
    });
    expect(offenders).toEqual([]);
  });
});
