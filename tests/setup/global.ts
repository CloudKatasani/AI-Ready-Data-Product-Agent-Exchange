import { join } from 'node:path';
import { getPack } from '../../src/lib/packs/registry';
import { buildWarehouse } from '../../src/lib/warehouse/build';

/** Builds (or reuses) a scale-S utilities warehouse for integration tests. */
export default async function setup(): Promise<void> {
  const outDir = join(process.cwd(), 'data', 'test-warehouse');
  await buildWarehouse(getPack('utilities'), { scale: 'S', outDir });
  process.env.KEYSTONE_TEST_WAREHOUSE = join(outDir, 'utilities.duckdb');
}
