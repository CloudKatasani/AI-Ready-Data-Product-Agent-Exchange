import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { goldenScenario, type GoldenFile } from '@/lib/agents/golden';
import { packsDir } from '@/lib/packs/registry';
import { QueryService } from '@/lib/query/query-service';
import type { WarehouseAdapter } from '@/lib/warehouse/adapter';
import { openWarehouseReadOnly } from '@/lib/warehouse/build';
import { MemoryLog, pack, rubrics } from '../setup/query';

// AC4.1 — every golden scenario answers in scripted mode in < 800 ms with values matching golden.json
// (recorded at scale M; `pnpm golden --pack utilities --update` regenerates after a reviewed change).
const golden = JSON.parse(readFileSync(join(packsDir(), 'utilities', 'golden.json'), 'utf8')) as GoldenFile;
let w: WarehouseAdapter;
let qs: QueryService;

beforeAll(async () => {
  w = await openWarehouseReadOnly(join(process.env.KEYSTONE_GOLDEN_WAREHOUSE_DIR ?? join(process.cwd(), 'data', 'test-warehouse', 'M'), 'utilities.duckdb'));
  qs = new QueryService({ pack, rubrics, warehouse: w, log: new MemoryLog() });
});
afterAll(async () => w.close());

describe('golden — utilities', () => {
  it('records every scenario at scale M', () => {
    expect(golden.scale).toBe('M');
    expect(Object.keys(golden.scenarios).sort()).toEqual(pack.scenarios.map((s) => s.id).sort());
  });

  it.each(pack.scenarios.map((s) => [s.id, s] as const))('%s matches golden.json in < 800 ms', async (id, s) => {
    const { golden: actual, answer } = await goldenScenario(pack, rubrics, qs, s);
    expect(actual).toEqual(golden.scenarios[id]);
    expect(answer.latencyMs).toBeLessThan(800);
  });
});
