import type { Pack, Rubrics } from '@/lib/packs/schema';
import { type CheckResult, Checks } from '@/lib/packs/validate';
import type { WarehouseAdapter } from '@/lib/warehouse/adapter';
import { systemPrincipal } from './principal';
import { QueryService } from './query-service';

/**
 * Validator category 4, compiler-backed: every metric compiles and returns a non-null value, and every
 * verified query (incl. pending-fix ones) compiles and executes. Runs through QueryService as the system
 * principal; the QueryLog rows go to a throwaway sink.
 */
export async function metricChecks(pack: Pack, rubrics: Rubrics, warehouse: WarehouseAdapter, results: CheckResult[] = []): Promise<CheckResult[]> {
  const c = new Checks(results, 4);
  const qs = new QueryService({ pack, rubrics, warehouse, log: { write: async () => 'validator' } });
  const who = systemPrincipal(pack);
  const run = async (check: string, subject: string, fn: () => Promise<void>) => {
    let error = '';
    try {
      await fn();
    } catch (e) {
      error = (e as Error).message;
    }
    c.expect(error === '', check, `${subject}: ${error}`, subject);
  };
  for (const v of pack.semantic) {
    for (const m of v.metrics) {
      await run('warehouse.metric_value', `${v.name}.${m.name}`, async () => {
        const r = await qs.run({ kind: 'metric', query: { view: v.name, metrics: [m.name] }, purpose: 'eval' }, who);
        const value = r.rows[0]?.[0];
        if (value === null || value === undefined) throw new Error('returned no value');
      });
    }
  }
  for (const vq of pack.verifiedQueries) {
    await run('warehouse.verified_query', vq.id, async () => {
      const r = await qs.run({ kind: 'metric', query: vq.query, purpose: 'eval', question: vq.question }, who);
      if (r.rowCount === 0) throw new Error('returned no rows');
    });
  }
  return results;
}
