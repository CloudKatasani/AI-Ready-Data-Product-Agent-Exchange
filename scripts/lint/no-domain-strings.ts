/**
 * Invariant I01 lint: no industry, company, KPI or column name from any pack may appear in src/.
 *
 * Phase 0 status: the scanner is in place; term extraction is schema-aware and arrives with the pack
 * schema in Phase 1 (`extractTerms` below). With no packs installed the lint passes trivially.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const PACKS_DIR = join(ROOT, 'packs');
const SRC_DIR = join(ROOT, 'src');
const SOURCE_EXT = /\.(ts|tsx|css)$/;

function walk(dir: string, filter: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, filter);
    return filter(path) ? [path] : [];
  });
}

/** Installed pack directories: everything under packs/ except `_shared`, `_schema` and other `_`-prefixed folders. */
export function packDirs(packsDir = PACKS_DIR): string[] {
  return readdirSync(packsDir)
    .filter((name) => !name.startsWith('_') && statSync(join(packsDir, name)).isDirectory())
    .map((name) => join(packsDir, name));
}

/**
 * Domain terms declared by a pack (company, industry, KPI, column and entity names).
 * Phase 1 replaces this with schema-aware extraction via the Zod pack loader (`src/lib/packs/schema.ts`).
 */
export function extractTerms(_packDir: string): string[] {
  return [];
}

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface Violation {
  file: string;
  line: number;
  term: string;
}

export function scan(terms: string[], files: string[]): Violation[] {
  const unique = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 3))];
  if (unique.length === 0) return [];
  const pattern = new RegExp(`\\b(${unique.map(escape).join('|')})\\b`, 'i');
  const violations: Violation[] = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        const m = pattern.exec(text);
        if (m?.[1]) violations.push({ file: relative(ROOT, file), line: i + 1, term: m[1] });
      });
  }
  return violations;
}

function main(): void {
  const packs = packDirs();
  const terms = packs.flatMap((dir) => extractTerms(dir));
  const violations = scan(terms, walk(SRC_DIR, (p) => SOURCE_EXT.test(p)));
  for (const v of violations) console.error(`${v.file}:${v.line}  domain term "${v.term}" belongs in packs/ (invariant I01)`);
  console.log(`no-domain-strings: ${packs.length} pack(s), ${terms.length} term(s), ${violations.length} violation(s)`);
  if (violations.length > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
