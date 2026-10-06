import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { getPack, getRubrics, listPackIds } from '../../src/lib/packs/registry';
import type { Pack } from '../../src/lib/packs/schema';
import { buildWarehouse, openWarehouseReadOnly } from '../../src/lib/warehouse/build';

/** Test app DB (relative to prisma/, Prisma's convention); also set for workers in vitest.config.ts. */
export const TEST_DATABASE_URL = 'file:../data/test-app.db';

/**
 * Builds (or reuses, content-hash cached) the scale-M warehouse — the demo scale and the scale golden
 * files are recorded at; the seeded lifecycle's real exit criteria (DQ, freshness) hold there — then
 * migrates and seeds a dedicated test app DB.
 */
export default async function setup(): Promise<void> {
  const goldenDir = join(process.cwd(), 'data', 'test-warehouse', 'M');
  // Every pack that loads (a pack still being authored is skipped); utilities stays the default test pack.
  const packs = listPackIds().flatMap((id): Pack[] => {
    try {
      return [getPack(id)];
    } catch {
      return [];
    }
  });
  const built: Pack[] = [];
  for (const p of packs) {
    try {
      await buildWarehouse(p, { scale: 'M', outDir: goldenDir });
      built.push(p);
    } catch (e) {
      console.warn(`test setup: ${p.manifest.id} warehouse failed to build — skipped (${(e as Error).message.split('\n')[0]})`);
    }
  }
  process.env.KEYSTONE_GOLDEN_WAREHOUSE_DIR = goldenDir;
  process.env.KEYSTONE_TEST_WAREHOUSE = join(goldenDir, 'utilities.duckdb');

  process.env.DATABASE_URL = TEST_DATABASE_URL;
  // A throwaway file owned by the test run: start from an empty file and apply the migrations.
  for (const f of ['test-app.db', 'test-app.db-journal']) rmSync(join(process.cwd(), 'data', f), { force: true });
  execSync('pnpm exec prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: 'ignore' });
  const { db } = await import('../../src/lib/db');
  const { seedPack } = await import('../../src/lib/presenter/seed');
  const { QueryService } = await import('../../src/lib/query/query-service');
  const rubrics = getRubrics();
  for (const pack of built) {
    const w = await openWarehouseReadOnly(join(goldenDir, `${pack.manifest.id}.duckdb`));
    try {
      await seedPack(db(), pack, { rubrics, qs: new QueryService({ pack, rubrics, warehouse: w, log: { write: async () => 'seed' } }) });
    } catch (e) {
      // A pack still being authored must not take the whole suite down; its own tests will fail loudly.
      console.warn(`test setup: ${pack.manifest.id} did not seed — ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await w.close();
    }
  }
  await db().$disconnect();
}
