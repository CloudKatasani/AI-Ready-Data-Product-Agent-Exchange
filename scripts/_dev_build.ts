import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { SourcesFile, type Pack } from '../src/lib/packs/schema';
import { buildWarehouse } from '../src/lib/warehouse/build';
import { openWarehouseReadOnly } from '../src/lib/warehouse/build';

const root = 'packs/utilities';
const sources = SourcesFile.parse(parse(readFileSync(join(root, 'warehouse/sources.yaml'), 'utf8')));
const sql = (['silver', 'gold'] as const).flatMap((layer) => readdirSync(join(root, 'warehouse', layer)).sort().map((f) => ({ path: f, layer, sql: readFileSync(join(root, 'warehouse', layer, f), 'utf8') })));
const pack = { root, manifest: { id: 'utilities', asOf: '2026-09-30', seed: 20261003 }, sources: sources.tables, sql, semantic: [], glossary: [], rules: [], verifiedQueries: [], synonyms: [], instructions: [], docs: [], products: [], agents: [], policies: { masking_policies: [], column_tags: [], row_access_policies: [], grants: [] }, dq: [] } as unknown as Pack;
const scale = (process.argv[2] ?? 'M') as 'S' | 'M' | 'L';
const r = await buildWarehouse(pack, { scale, outDir: 'data/warehouse', force: true, path: `data/warehouse/_dev_${scale}.duckdb` });
console.log(r.elapsedMs, r.timings);
const w = await openWarehouseReadOnly(r.path);
for (const q of process.argv.slice(3)) console.log(JSON.stringify((await w.query(q)).rows));
await w.close();
