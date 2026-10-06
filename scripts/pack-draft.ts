/**
 * pnpm pack:draft --from <deep pack> --id <new id> --name <name> --code <ABC> --industry <text>
 *   --company <name> --short <ABC> --hq <town> [--description <text>] [--regions a,b,c,d,e]
 * Pack Drafter, offline mode (01 §M13): clones a deep pack, re-skins it as a draft, writes packs/<id>/ and runs
 * the static validator. Build its warehouse with `pnpm warehouse:build --pack <id>` to run the full checks.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { draftPack, validateDraftInput } from '../src/lib/packs/drafter';
import { getStories, listPackIds, packsDir } from '../src/lib/packs/registry';
import { validatePackStatic } from '../src/lib/packs/validate';
import { parseArgs } from './cli-args';

const { flags } = parseArgs(process.argv.slice(2));
const s = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : '');
const from = s('from') || 'utilities';
const input = {
  id: s('id'),
  name: s('name') || s('id'),
  code: s('code').toUpperCase(),
  industry: s('industry') || s('name'),
  company: { name: s('company'), short: s('short'), hq: s('hq') || 'Harbourton', description: s('description') || `${s('company')} (draft re-skinned from ${from})` },
  regions: s('regions') ? s('regions').split(',') : [],
};
validateDraftInput(input, listPackIds());

const root = join(packsDir(), from);
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = Object.fromEntries(walk(root).map((f) => [relative(root, f), readFileSync(f, 'utf8')]));
const out = draftPack(files, input);
const dest = join(packsDir(), input.id);
for (const [path, text] of Object.entries(out)) {
  mkdirSync(dirname(join(dest, path)), { recursive: true });
  writeFileSync(join(dest, path), text);
}
const { report } = validatePackStatic(dest, getStories());
console.log(`${input.id}: drafted ${Object.keys(out).length} files from ${from} · static validation ${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
for (const r of [...report.errors, ...report.warnings].slice(0, 20)) console.log(`  ${r.check}: ${r.message}`);
process.exit(report.errors.length ? 1 : 0);
