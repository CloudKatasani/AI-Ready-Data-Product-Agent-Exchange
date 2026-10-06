import { join } from 'node:path';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { principalFor } from '@/lib/query/principal';
import { QueryService, type QueryLogEntry } from '@/lib/query/query-service';
import { openWarehouseReadOnly } from '@/lib/warehouse/build';
import type { WarehouseAdapter } from '@/lib/warehouse/adapter';

export const pack = getPack('utilities');
export const rubrics = getRubrics();

export function persona(archetype: 'A' | 'B' | 'C' | 'D' | 'E') {
  const p = pack.personas.find((x) => x.archetype === archetype);
  if (!p) throw new Error(archetype);
  return principalFor(pack, p.id);
}

export class MemoryLog {
  entries: QueryLogEntry[] = [];
  async write(e: QueryLogEntry): Promise<string> {
    this.entries.push(e);
    return `ql_${this.entries.length}`;
  }
}

let warehouse: Promise<WarehouseAdapter> | undefined;
export function testWarehouse(): Promise<WarehouseAdapter> {
  warehouse ??= openWarehouseReadOnly(process.env.KEYSTONE_TEST_WAREHOUSE ?? join(process.cwd(), 'data', 'test-warehouse', 'utilities.duckdb'));
  return warehouse;
}

export async function service(log = new MemoryLog()): Promise<{ qs: QueryService; log: MemoryLog }> {
  return { qs: new QueryService({ pack, rubrics, warehouse: await testWarehouse(), log }), log };
}
