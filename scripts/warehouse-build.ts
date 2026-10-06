/**
 * pnpm warehouse:build [--pack <id>] [--scale S|M|L] [--force]
 * Builds data/warehouse/<pack>.duckdb for one or all installed packs (cached by pack content hash).
 */
import { join } from 'node:path';
import { getPack, listPackIds } from '../src/lib/packs/registry';
import { Scale } from '../src/lib/packs/schema';
import { buildWarehouse } from '../src/lib/warehouse/build';
import { parseArgs } from './cli-args';

const { flags } = parseArgs(process.argv.slice(2));
const scale = Scale.parse(flags.scale ?? process.env.DEMO_SCALE ?? 'M');
const outDir = process.env.WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'warehouse');
const ids = typeof flags.pack === 'string' ? [flags.pack] : listPackIds();
if (ids.length === 0) {
  console.log('No packs installed.');
  process.exit(0);
}
for (const id of ids) {
  const r = await buildWarehouse(getPack(id), { scale, outDir, force: flags.force === true });
  const rows = Object.values(r.checksums).reduce((n, c) => n + c.rows, 0);
  console.log(
    `${id}: ${r.cached ? 'cached' : 'built'} ${r.path} — scale ${r.scale}, ${Object.keys(r.checksums).length} tables, ${rows.toLocaleString('en-US')} rows, ${(r.elapsedMs / 1000).toFixed(1)} s`,
  );
  if (!r.cached) console.log(`  timings (ms): ${Object.entries(r.timings).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
}
