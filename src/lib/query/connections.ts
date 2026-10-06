import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openWarehouseReadOnly } from '@/lib/warehouse/build';
import type { WarehouseAdapter } from '@/lib/warehouse/adapter';

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

/** Read-only connection to a pack's warehouse, opened once per process. Only QueryService uses this. */
export function warehouseFor(packId: string): Promise<WarehouseAdapter> {
  const cache = (globalForWarehouse.keystoneWarehouses ??= new Map());
  let w = cache.get(packId);
  if (!w) {
    const path = warehousePath(packId);
    if (!existsSync(path)) return Promise.reject(new WarehouseMissing(packId));
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
