/**
 * Product health board (01 §M10 Health): freshness, volume, DQ and schema signals per product, from the
 * latest DQ rule results and the open incidents. Pure; the caller loads the rows.
 */
import type { IncidentTemplate, Pack } from '@/lib/packs/schema';

export type Signal = 'ok' | 'warn' | 'fail';

export interface HealthRow {
  productId: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  freshness: Signal;
  volume: Signal;
  quality: Signal;
  schema: Signal;
  dqScore: number | null;
  failedRules: string[];
  incidents: string[];
}

export interface HealthInput {
  /** Latest result per DQ rule of the product. */
  rules: { ruleId: string; dimension: string; passed: boolean }[];
  dqScore: number | null;
  open: IncidentTemplate[];
}

const worst = (...s: Signal[]): Signal => (s.includes('fail') ? 'fail' : s.includes('warn') ? 'warn' : 'ok');

export function healthRow(pack: Pack, productId: string, input: HealthInput): HealthRow {
  const p = pack.products.find((x) => x.id === productId);
  const mine = input.open.filter((t) => t.affects.products.includes(productId));
  const failed = input.rules.filter((r) => !r.passed);
  const failedIn = (dims: string[]) => failed.some((r) => dims.includes(r.dimension));
  const kinds = new Set(mine.map((t) => t.kind));
  const freshness = worst(kinds.has('late_feed') ? 'fail' : 'ok', failedIn(['timeliness']) ? 'warn' : 'ok');
  const volume = worst(kinds.has('volume_anomaly') || kinds.has('duplicate_load') ? 'fail' : 'ok');
  const quality = worst(kinds.has('null_spike') ? 'fail' : 'ok', failedIn(['completeness', 'validity', 'uniqueness', 'consistency', 'accuracy']) ? 'warn' : 'ok');
  const schema = kinds.has('schema_drift') ? 'fail' : 'ok';
  const status: HealthRow['status'] = mine.some((t) => t.kind === 'schema_drift' && t.severity === 'SEV1') ? 'down' : mine.length || worst(freshness, volume, quality, schema) === 'fail' ? 'degraded' : 'healthy';
  return { productId, name: p?.name ?? productId, status, freshness, volume, quality, schema, dqScore: input.dqScore, failedRules: failed.map((r) => r.ruleId).sort(), incidents: mine.map((t) => t.id) };
}
