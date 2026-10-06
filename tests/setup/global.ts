import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { getPack, getRubrics } from '../../src/lib/packs/registry';
import { buildWarehouse, openWarehouseReadOnly } from '../../src/lib/warehouse/build';

/** Test app DB (relative to prisma/, Prisma's convention); also set for workers in vitest.config.ts. */
export const TEST_DATABASE_URL = 'file:../data/test-app.db';

/**
 * Builds (or reuses, content-hash cached) the warehouses tests need — scale S for integration tests and
 * scale M (the scale golden files are recorded at) — then migrates and seeds a dedicated test app DB.
 */
export default async function setup(): Promise<void> {
  const outDir = join(process.cwd(), 'data', 'test-warehouse');
  const pack = getPack('utilities');
  await buildWarehouse(pack, { scale: 'S', outDir });
  process.env.KEYSTONE_TEST_WAREHOUSE = join(outDir, 'utilities.duckdb');
  const goldenDir = join(outDir, 'M');
  await buildWarehouse(pack, { scale: 'M', outDir: goldenDir });
  process.env.KEYSTONE_GOLDEN_WAREHOUSE_DIR = goldenDir;

  process.env.DATABASE_URL = TEST_DATABASE_URL;
  // A throwaway file owned by the test run: start from an empty file and apply the migrations.
  for (const f of ['test-app.db', 'test-app.db-journal']) rmSync(join(process.cwd(), 'data', f), { force: true });
  execSync('pnpm exec prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: 'ignore' });
  const { db } = await import('../../src/lib/db');
  const { seedPack } = await import('../../src/lib/presenter/seed');
  const { QueryService } = await import('../../src/lib/query/query-service');
  const w = await openWarehouseReadOnly(join(outDir, 'utilities.duckdb'));
  const rubrics = getRubrics();
  await seedPack(db(), pack, { rubrics, qs: new QueryService({ pack, rubrics, warehouse: w, log: { write: async () => 'seed' } }) });
  await w.close();
  await db().$disconnect();
}
