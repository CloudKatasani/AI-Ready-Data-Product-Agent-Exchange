/**
 * pnpm snowflake:bundle --pack <id> [--out <dir>] [--scale S|M|L]
 * Builds (or reuses) the pack's warehouse and writes a Snowflake deploy bundle (ADR-0025): Parquet data,
 * deploy.sql, verify.sql and manifest.json. Default output: data/snowflake/<pack>. Then:
 *   cd <out> && snowsql -f deploy.sql && snowsql -f verify.sql
 */
import { join, resolve } from 'node:path';
import { getPack } from '../src/lib/packs/registry';
import { Scale } from '../src/lib/packs/schema';
import { buildWarehouse } from '../src/lib/warehouse/build';
import { buildSnowflakeBundle } from '../src/lib/warehouse/snowflake-deploy';
import { parseArgs } from './cli-args';

const { flags } = parseArgs(process.argv.slice(2));
const packId = typeof flags.pack === 'string' ? flags.pack : '';
if (!packId) {
  console.error('Usage: pnpm snowflake:bundle --pack <id> [--out <dir>] [--scale S|M|L]');
  process.exit(1);
}
const pack = getPack(packId);
const scale = Scale.parse(typeof flags.scale === 'string' ? flags.scale : (process.env.DEMO_SCALE ?? 'M'));
const warehouseDir = resolve(process.env.WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'warehouse'));
const built = await buildWarehouse(pack, { scale, outDir: warehouseDir });
const out = resolve(typeof flags.out === 'string' ? flags.out : join(process.cwd(), 'data', 'snowflake', packId));
const bundle = await buildSnowflakeBundle(pack, built.path, out);
const rows = bundle.objects.reduce((n, o) => n + o.rows, 0);
console.log(`${packId}: ${bundle.objects.length} objects, ${rows.toLocaleString('en-US')} rows → ${out}`);
console.log(`Next: cd ${out} && snowsql -f deploy.sql && snowsql -f verify.sql (database ${bundle.database})`);
