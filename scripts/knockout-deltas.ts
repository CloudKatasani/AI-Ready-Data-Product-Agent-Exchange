/**
 * pnpm knockout:deltas [--pack id] [--update]
 * Computes each knockout answer's single-layer delta (%) through the real knockout query path and compares
 * it with `declared_delta_pct` in packs/<id>/knockout.yaml. `--update` writes the computed values.
 * Exits 1 on a mismatch without --update.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPack, getRubrics, listPackIds, packsDir } from '../src/lib/packs/registry';
import { principalFor } from '../src/lib/query/principal';
import { QueryService } from '../src/lib/query/query-service';
import { singleLayerDeltas } from '../src/lib/strategy/knockout';
import { buildWarehouse, openWarehouseReadOnly } from '../src/lib/warehouse/build';
import { parseArgs } from './cli-args';

const { flags } = parseArgs(process.argv.slice(2));
const ids = typeof flags.pack === 'string' ? [flags.pack] : listPackIds().filter((id) => getPack(id).manifest.depth === 'deep');
let mismatch = false;

/** Rewrites the `declared_delta_pct:` line inside each answer's block, keeping comments and layout. */
function writeDeltas(text: string, deltas: Record<string, Record<string, number>>): string {
  const lines = text.split('\n');
  let current: string | null = null;
  return lines
    .map((line) => {
      const id = /^\s*- id: (KO-[A-Z]+-\d+)/.exec(line)?.[1];
      if (id) current = id;
      const m = /^(\s*)declared_delta_pct:/.exec(line);
      if (m && current && deltas[current]) {
        const body = Object.entries(deltas[current] ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ');
        return `${m[1]}declared_delta_pct: { ${body} }`;
      }
      return line;
    })
    .join('\n');
}

for (const id of ids) {
  const pack = getPack(id);
  const built = await buildWarehouse(pack, { scale: 'M', outDir: process.env.WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'warehouse') });
  const w = await openWarehouseReadOnly(built.path);
  try {
    const qs = new QueryService({ pack, rubrics: getRubrics(), warehouse: w, log: { write: async () => 'knockout' } });
    const steward = pack.personas.find((p) => p.archetype === 'D') ?? pack.personas[0];
    if (!steward) throw new Error(`${id}: no persona`);
    const deltas = (await singleLayerDeltas(pack, qs, principalFor(pack, steward.id))) as Record<string, Record<string, number>>;
    for (const a of pack.knockout.answers) {
      const got = deltas[a.id] ?? {};
      const declared = a.declared_delta_pct as Record<string, number>;
      const diff = Object.keys({ ...got, ...declared }).filter((k) => Math.abs((got[k] ?? NaN) - (declared[k] ?? NaN)) > 0.1 || (got[k] === undefined) !== (declared[k] === undefined));
      console.log(`${id} ${a.id}: ${JSON.stringify(got)}${diff.length ? `  ≠ declared on ${diff.join(', ')}` : ''}`);
      if (diff.length) mismatch = true;
    }
    if (flags.update) {
      const file = join(packsDir(), id, 'knockout.yaml');
      writeFileSync(file, writeDeltas(readFileSync(file, 'utf8'), deltas));
    }
  } finally {
    await w.close();
  }
}
if (mismatch && !flags.update) process.exit(1);
