/**
 * OpenLineage export for a product: one COMPLETE run event per transformation edge in its lineage
 * (Bronze → Silver → Gold → semantic → product), with the pack database as namespace. Deterministic
 * run ids (hash of the edge) and event time on the pack clock.
 */
import { createHash } from 'node:crypto';
import { lineageAround } from '@/lib/packs/lineage';
import type { Pack } from '@/lib/packs/schema';

const uuid = (s: string) => {
  const h = createHash('sha256').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export function openLineage(pack: Pack, productId: string): Record<string, unknown>[] {
  const ns = `snowflake://${pack.manifest.database.toLowerCase()}`;
  const g = lineageAround(pack, productId);
  const byTarget = new Map<string, string[]>();
  for (const e of g.edges) byTarget.set(e.to, [...(byTarget.get(e.to) ?? []), e.from]);
  return [...byTarget.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([target, inputs]) => ({
    eventType: 'COMPLETE',
    eventTime: `${pack.manifest.asOf}T06:00:00.000Z`,
    producer: 'https://keystone.demo/openlineage',
    schemaURL: 'https://openlineage.io/spec/2-0-2/OpenLineage.json#/$defs/RunEvent',
    run: { runId: uuid(`${productId}:${target}`) },
    job: { namespace: ns, name: `build.${target}` },
    inputs: inputs.sort().map((name) => ({ namespace: ns, name })),
    outputs: [{ namespace: ns, name: target }],
  }));
}
