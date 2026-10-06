/**
 * pnpm golden [--pack id] [--update] [--scale M]
 * Builds the warehouse (cached), regenerates golden records and compares them with the committed
 * `packs/<id>/golden.json`. `--update` rewrites the file and writes a diff report to tests/golden/report.md.
 * Exits 1 on drift without --update.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeGolden, diffGolden, type GoldenFile } from '../src/lib/agents/golden';
import { getPack, getRubrics, listPackIds, packsDir } from '../src/lib/packs/registry';
import { Scale } from '../src/lib/packs/schema';
import { QueryService } from '../src/lib/query/query-service';
import { buildWarehouse, openWarehouseReadOnly } from '../src/lib/warehouse/build';
import { parseArgs } from './cli-args';

const { flags } = parseArgs(process.argv.slice(2));
const scale = Scale.parse(flags.scale ?? 'M');
const ids = typeof flags.pack === 'string' ? [flags.pack] : listPackIds().filter((id) => getPack(id).scenarios.length > 0);
const report: string[] = ['# Golden drift report', ''];
let drift = false;

for (const id of ids) {
  const pack = getPack(id);
  const built = await buildWarehouse(pack, { scale, outDir: process.env.WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'warehouse') });
  const w = await openWarehouseReadOnly(built.path);
  try {
    const qs = new QueryService({ pack, rubrics: getRubrics(), warehouse: w, log: { write: async () => 'golden' } });
    const actual = await computeGolden(pack, getRubrics(), qs, scale);
    const file = join(packsDir(), id, 'golden.json');
    const expected = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as GoldenFile) : { pack: id, version: '', scale, scenarios: {} };
    const diffs = diffGolden(expected, actual);
    report.push(`## ${id}`, '', diffs.length ? diffs.map((d) => `- ${d}`).join('\n') : 'No changes.', '');
    console.log(`${id}: ${Object.keys(actual.scenarios).length} scenarios · ${diffs.length} difference(s)`);
    for (const d of diffs.slice(0, 40)) console.log(`  ${d}`);
    if (flags.update) writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    else if (diffs.length) drift = true;
  } finally {
    await w.close();
  }
}
if (flags.update) {
  mkdirSync(join(process.cwd(), 'tests', 'golden'), { recursive: true });
  writeFileSync(join(process.cwd(), 'tests', 'golden', 'report.md'), `${report.join('\n')}\n`);
}
process.exit(drift ? 1 : 0);
