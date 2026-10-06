import { join } from 'node:path';
import { getPack } from '../../src/lib/packs/registry';
import { buildWarehouse } from '../../src/lib/warehouse/build';

/**
 * Builds (or reuses, content-hash cached) the warehouses tests need: scale S for integration tests and
 * scale M — the scale golden files are recorded at — for golden tests.
 */
export default async function setup(): Promise<void> {
  const outDir = join(process.cwd(), 'data', 'test-warehouse');
  await buildWarehouse(getPack('utilities'), { scale: 'S', outDir });
  process.env.KEYSTONE_TEST_WAREHOUSE = join(outDir, 'utilities.duckdb');
  const goldenDir = join(process.cwd(), 'data', 'test-warehouse', 'M');
  await buildWarehouse(getPack('utilities'), { scale: 'M', outDir: goldenDir });
  process.env.KEYSTONE_GOLDEN_WAREHOUSE_DIR = goldenDir;
}
