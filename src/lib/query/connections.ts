import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getEnv, snowflakeConfig } from '@/lib/config/env';
import { getPack } from '@/lib/packs/registry';
import { Scale } from '@/lib/packs/schema';
import { buildWarehouse, openWarehouseReadOnly } from '@/lib/warehouse/build';
import type { WarehouseAdapter } from '@/lib/warehouse/adapter';
import { SnowflakeAdapter } from '@/lib/warehouse/snowflake';

const globalForWarehouse = globalThis as unknown as { keystoneWarehouses?: Map<string, Promise<WarehouseAdapter>> };

export function warehousePath(packId: string): string {
  return join(resolve(process.env.WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'warehouse')), `${packId}.duckdb`);
}

export class WarehouseMissing extends Error {
  constructor(readonly packId: string) {
    super(`The ${packId} warehouse has not been built yet. Run: pnpm warehouse:build --pack ${packId}`);
    this.name = 'WarehouseMissing';
  }
}

/**
 * Builds a missing warehouse on first use when `KEYSTONE_WAREHOUSE_AUTOBUILD=1` (the container image ships
 * without warehouse files to stay small; generation is deterministic, so the result equals a prebuilt one).
 */
async function buildThenOpen(packId: string, path: string): Promise<WarehouseAdapter> {
  const dir = resolve(process.env.WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'warehouse'));
  await buildWarehouse(getPack(packId), { scale: Scale.parse(process.env.DEMO_SCALE ?? 'M'), outDir: dir });
  return openWarehouseReadOnly(path);
}

/** Read-only connection to a pack's warehouse, opened once per process. Only QueryService uses this. */
export function warehouseFor(packId: string): Promise<WarehouseAdapter> {
  const cache = (globalForWarehouse.keystoneWarehouses ??= new Map());
  let w = cache.get(packId);
  if (!w && getEnv().WAREHOUSE_ADAPTER === 'snowflake') {
    // ADR-0025: the pack's database in Snowflake, over the SQL API. Experimental: mock-tested only.
    const cfg = snowflakeConfig();
    if (!cfg) return Promise.reject(new Error('WAREHOUSE_ADAPTER=snowflake needs SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER and SNOWFLAKE_PRIVATE_KEY_PATH.'));
    w = Promise.resolve(new SnowflakeAdapter(cfg, { database: getPack(packId).manifest.database }));
    cache.set(packId, w);
    return w;
  }
  if (!w) {
    const path = warehousePath(packId);
    if (!existsSync(path)) {
      if (process.env.KEYSTONE_WAREHOUSE_AUTOBUILD !== '1') return Promise.reject(new WarehouseMissing(packId));
      w = buildThenOpen(packId, path);
      cache.set(packId, w);
      w.catch(() => cache.delete(packId));
      return w;
    }
    w = openWarehouseReadOnly(path);
    cache.set(packId, w);
    w.catch(() => cache.delete(packId));
  }
  return w;
}

/** Closes cached connections (tests, reset). */
export async function closeWarehouses(): Promise<void> {
  const cache = globalForWarehouse.keystoneWarehouses;
  if (!cache) return;
  const all = [...cache.values()];
  cache.clear();
  for (const w of all) await (await w).close();
}
