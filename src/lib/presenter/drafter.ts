/**
 * Pack Drafter orchestration (01 §M13, offline): clone + re-skin a deep pack as a draft under packs/, run the
 * static validator and build its warehouse. Live drafting (an LLM writing sections under the pack schema)
 * is not offered without an API key.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { getEnv } from '@/lib/config/env';
import { type DraftInput, DraftError, draftPack, validateDraftInput } from '@/lib/packs/drafter';
import { clearPackCache, getPack, getStories, hasPack, listPackIds, packsDir } from '@/lib/packs/registry';
import { validatePackStatic } from '@/lib/packs/validate';
import { buildWarehouse } from '@/lib/warehouse/build';

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

export async function draftAndBuild(from: string, input: DraftInput): Promise<{ ok: boolean; errors: string[] }> {
  if (!hasPack(from) || getPack(from).manifest.depth !== 'deep') throw new DraftError('Pick a deep pack to start from.');
  validateDraftInput(input, listPackIds());
  const root = join(packsDir(), from);
  const out = draftPack(Object.fromEntries(walk(root).map((f) => [relative(root, f), readFileSync(f, 'utf8')])), input);
  const dest = join(packsDir(), input.id);
  for (const [path, text] of Object.entries(out)) {
    mkdirSync(dirname(join(dest, path)), { recursive: true });
    writeFileSync(join(dest, path), text);
  }
  clearPackCache();
  const { pack, report } = validatePackStatic(dest, getStories());
  if (!pack || report.errors.length) return { ok: false, errors: report.errors.map((e) => `${e.check}: ${e.message}`) };
  await buildWarehouse(pack, { scale: getEnv().DEMO_SCALE, outDir: getEnv().WAREHOUSE_DIR });
  return { ok: true, errors: [] };
}
