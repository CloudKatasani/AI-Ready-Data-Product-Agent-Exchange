/**
 * Invariant I01 lint: no industry, company, KPI or column name from any pack may appear in src/.
 *
 * Terms come from validator category 10 (`lintTerms`): company, products, agents, KPIs, views, tables,
 * personas, domains and each pack's `lint_terms`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readPack } from '../../src/lib/packs/loader';
import { lintTerms } from '../../src/lib/packs/validate/policy-checks';

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
    .filter((name) => existsSync(join(packsDir, name, 'pack.yaml')) && statSync(join(packsDir, name)).isDirectory())
    .map((name) => join(packsDir, name));
}

/** Domain terms declared by a pack. A pack that fails to load contributes its directory name only. */
export function extractTerms(packDir: string): string[] {
  const { pack } = readPack(packDir);
  return pack ? lintTerms(pack) : [packDir.split('/').pop() ?? packDir];
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
