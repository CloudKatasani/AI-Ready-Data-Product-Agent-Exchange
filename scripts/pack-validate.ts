/**
 * pnpm pack:validate [id] [--scale M] [--json] [--static]
 * Static checks (categories 1–3, 5, 6, 9, 10) plus warehouse (4), scenario (7) and agent (8) checks against a built
 * warehouse (built on demand, cached). Writes data/reports/<pack>-validation.json. Exits 1 on errors.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRubrics, getStories, listPackIds, packsDir } from '../src/lib/packs/registry';
import { Scale } from '../src/lib/packs/schema';
import { summarise, validatePackStatic } from '../src/lib/packs/validate';
import { buildWarehouse, openWarehouseReadOnly } from '../src/lib/warehouse/build';
import { metricChecks } from '../src/lib/query/validate';
import { scenarioChecks } from '../src/lib/agents/validate';
import { QueryService } from '../src/lib/query/query-service';
import { warehouseChecks } from '../src/lib/warehouse/validate';
import { parseArgs } from './cli-args';

const { flags, positional } = parseArgs(process.argv.slice(2));
const scale = Scale.parse(flags.scale ?? 'M');
const ids = positional.length ? positional : listPackIds();
const stories = getStories();
const reportDir = join(process.cwd(), 'data', 'reports');
mkdirSync(reportDir, { recursive: true });
let failed = false;

for (const id of ids) {
  const { pack, report: staticReport } = validatePackStatic(join(packsDir(), id), stories);
  let results = staticReport.results;
  if (pack && !flags.static) {
    const built = await buildWarehouse(pack, { scale, outDir: process.env.WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'warehouse') });
    const w = await openWarehouseReadOnly(built.path);
    try {
      results = await warehouseChecks(pack, w, [...results]);
      results = await metricChecks(pack, getRubrics(), w, results);
      const qs = new QueryService({ pack, rubrics: getRubrics(), warehouse: w, log: { write: async () => 'validator' } });
      results = await scenarioChecks(pack, getRubrics(), qs, results);
    } finally {
      await w.close();
    }
  }
  const report = summarise(id, results, staticReport.lintTerms);
  writeFileSync(join(reportDir, `${id}-validation.json`), JSON.stringify(report, null, 2));
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n${id}: ${report.checks} checks · ${report.errors.length} errors · ${report.warnings.length} warnings`);
    for (const [cat, s] of Object.entries(report.byCategory)) console.log(`  ${cat.padEnd(30)} ${String(s.checks).padStart(5)} checks  ${s.errors} errors  ${s.warnings} warnings`);
    for (const e of report.errors.slice(0, 80)) console.log(`  ✕ [${e.category}] ${e.check}: ${e.message}`);
    if (report.errors.length > 80) console.log(`  … ${report.errors.length - 80} more errors (see data/reports/${id}-validation.json)`);
    for (const wn of report.warnings.slice(0, 20)) console.log(`  ! [${wn.category}] ${wn.check}: ${wn.message}`);
  }
  if (report.errors.length > 0) failed = true;
}
process.exit(failed ? 1 : 0);
