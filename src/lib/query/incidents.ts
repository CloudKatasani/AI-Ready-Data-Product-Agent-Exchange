/**
 * Incident effects (05 §2 step 4). While a pack incident is open, every governed query that touches its
 * object reads an overlay instead of the base object, so the same compiled SQL sees incident data
 * (ADR-0019: overlays are query-time subqueries, not DDL, so Break/Resolve need no warehouse writes and
 * reset stays a snapshot copy). Pure and deterministic: rows are chosen by `hash(key) % 100`.
 */
import type { IncidentTemplate, Pack } from '@/lib/packs/schema';
import type { PolicyApplication } from './types';

export interface ColumnInfo {
  name: string;
  type: string;
}

/** A governed query hit a column an open schema-drift incident has renamed. */
export class IncidentBlocked extends Error {
  constructor(
    message: string,
    readonly incidentId: string,
    readonly productIds: string[],
  ) {
    super(message);
    this.name = 'IncidentBlocked';
  }
}

const q = (c: string) => `"${c.replace(/"/g, '""')}"`;

/** Open incident templates (by template id) that are known to the pack. */
export function openTemplates(pack: Pack, open: string[] | undefined): IncidentTemplate[] {
  if (!open?.length) return [];
  const ids = new Set(open);
  return pack.incidents.filter((t) => ids.has(t.id));
}

/** The time column an incident filters on: the template's column if temporal, else the first temporal one. */
function timeColumn(t: IncidentTemplate, cols: ColumnInfo[]): string | undefined {
  const temporal = cols.filter((c) => /TIMESTAMP|DATE/i.test(c.type));
  return temporal.find((c) => c.name === t.column)?.name ?? temporal[0]?.name;
}

/** Plain-language effect of one template (shown as the incident policy chip and answer banner). */
export function incidentDetail(t: IncidentTemplate): string {
  return `${t.id} (${t.severity}) — ${t.title}`;
}

/**
 * Wraps `base` (the object or an already-governed subquery over it) with the effects of every open incident
 * on `fqn`. Returns the base unchanged when nothing applies.
 */
export function incidentSource(fqn: string, base: string, cols: ColumnInfo[], templates: IncidentTemplate[]): { sql: string; applied: PolicyApplication[]; renamed: { from: string; to: string; incidentId: string }[] } {
  const applied: PolicyApplication[] = [];
  const renamed: { from: string; to: string; incidentId: string }[] = [];
  let sql = base;
  const key = cols[0]?.name;
  for (const t of templates.filter((x) => x.object === fqn)) {
    const p = t.params;
    const col = t.column && cols.some((c) => c.name === t.column) ? t.column : undefined;
    const ts = timeColumn(t, cols);
    let next: string | null = null;
    switch (t.kind) {
      case 'late_feed':
        if (ts) next = `(SELECT * FROM ${sql} __i WHERE ${q(ts)} <= (SELECT max(${q(ts)}) FROM ${fqn}) - INTERVAL (${p.lag_hours ?? 6}) HOUR)`;
        break;
      case 'volume_anomaly':
        if (ts) next = `(SELECT * FROM ${sql} __i WHERE CAST(${q(ts)} AS DATE) <= CAST((SELECT max(${q(ts)}) FROM ${fqn}) AS DATE) - ${p.missing_days ?? 3})`;
        break;
      case 'null_spike':
        if (col && key) next = `(SELECT * REPLACE (CASE WHEN hash(${q(key)}) % 100 < ${p.null_pct ?? 15} THEN NULL ELSE ${q(col)} END AS ${q(col)}) FROM ${sql} __i)`;
        break;
      case 'duplicate_load':
        if (key) next = `(SELECT * FROM ${sql} __i UNION ALL SELECT * FROM ${sql} __d WHERE hash(${q(key)}) % 100 < ${p.duplicate_pct ?? 10})`;
        break;
      case 'schema_drift':
        if (col && p.rename_to) {
          next = `(SELECT * RENAME (${q(col)} AS ${q(p.rename_to)}) FROM ${sql} __i)`;
          renamed.push({ from: col, to: p.rename_to, incidentId: t.id });
        }
        break;
    }
    applied.push({ kind: 'incident', target: fqn, detail: incidentDetail(t), ruleOrPolicyId: t.id });
    if (next) sql = next;
  }
  return { sql, applied, renamed };
}

/** Product health under the open incidents: SEV1 schema drift takes a product down, anything else degrades it. */
export function productHealth(templates: IncidentTemplate[], productId: string): 'healthy' | 'degraded' | 'down' {
  const hits = templates.filter((t) => t.affects.products.includes(productId));
  if (!hits.length) return 'healthy';
  return hits.some((t) => t.kind === 'schema_drift' && t.severity === 'SEV1') ? 'down' : 'degraded';
}
