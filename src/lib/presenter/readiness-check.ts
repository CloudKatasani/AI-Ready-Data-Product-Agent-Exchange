/**
 * Operational readiness (12 §5): the app DB answers, every installed pack loads, and each pack's warehouse is
 * built for the current pack content (content hash in the build's meta file). Shared by `/api/ready` and
 * `pnpm doctor`. Never reads or reports secret values.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEnv } from '@/lib/config/env';
import { db } from '@/lib/db';
import { getPack, listPackIds } from '@/lib/packs/registry';
import { Scale } from '@/lib/packs/schema';
import { packContentHash } from '@/lib/warehouse/build';

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function readinessChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  try {
    await db().$queryRawUnsafe('SELECT 1');
    checks.push({ name: 'app-db', ok: true, detail: 'App DB reachable' });
  } catch (e) {
    checks.push({ name: 'app-db', ok: false, detail: `App DB unreachable: ${e instanceof Error ? e.message.split('\n')[0] : 'error'}` });
  }
  const env = getEnv();
  const scale = Scale.parse(env.DEMO_SCALE);
  for (const id of listPackIds()) {
    try {
      const pack = getPack(id);
      const meta = join(env.WAREHOUSE_DIR, `${id}.duckdb.meta.json`);
      if (!existsSync(meta)) {
        checks.push({ name: `warehouse:${id}`, ok: false, detail: `${id}: warehouse not built (pnpm warehouse:build --pack ${id})` });
        continue;
      }
      const m = JSON.parse(readFileSync(meta, 'utf8')) as { contentHash?: string; scale?: string };
      const fresh = m.contentHash === packContentHash(pack, (m.scale as typeof scale) ?? scale);
      checks.push({ name: `warehouse:${id}`, ok: fresh, detail: fresh ? `${id}: warehouse current (${m.scale})` : `${id}: warehouse is stale for the pack content — rebuild` });
    } catch (e) {
      checks.push({ name: `pack:${id}`, ok: false, detail: `${id}: pack does not load (${e instanceof Error ? e.message.split('\n')[0] : 'error'})` });
    }
  }
  return checks;
}
