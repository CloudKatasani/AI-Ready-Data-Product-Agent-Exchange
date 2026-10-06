/**
 * Real profiling (05 §6, Stage 3): per source object, row count and per-column null %, distinct count,
 * min/max and top values — computed by DuckDB through QueryService as the system principal.
 */
import type { DataProduct, Pack } from '@/lib/packs/schema';
import { systemPrincipal } from '@/lib/query/principal';
import type { QueryService } from '@/lib/query/query-service';
import { upstreamObjects } from './artifacts/blueprint';

export interface ColumnProfile {
  column: string;
  nullPct: number;
  distinct: number;
  min: string | null;
  max: string | null;
}

export interface ObjectProfile {
  object: string;
  rows: number;
  columns: ColumnProfile[];
  worstNullPct: number;
}

const ident = (c: string) => `"${c.replace(/"/g, '""')}"`;

export async function profileObject(pack: Pack, qs: QueryService, fqn: string, maxColumns = 24): Promise<ObjectProfile> {
  const who = systemPrincipal(pack);
  const cols = (await qs.describe(fqn)).slice(0, maxColumns);
  const parts = cols.flatMap((c) => [
    `avg(CASE WHEN ${ident(c.name)} IS NULL THEN 1.0 ELSE 0.0 END) AS ${ident(`${c.name}__null`)}`,
    `count(DISTINCT ${ident(c.name)}) AS ${ident(`${c.name}__distinct`)}`,
    `CAST(min(${ident(c.name)}) AS VARCHAR) AS ${ident(`${c.name}__min`)}`,
    `CAST(max(${ident(c.name)}) AS VARCHAR) AS ${ident(`${c.name}__max`)}`,
  ]);
  const r = await qs.run({ kind: 'sql', sql: `SELECT count(*) AS n${parts.length ? `, ${parts.join(', ')}` : ''} FROM ${fqn}`, source: 'profiling' }, who);
  const row = r.rows[0] ?? [];
  const get = (name: string) => row[r.columns.findIndex((c) => c.name === name)];
  const columns = cols.map((c) => ({
    column: c.name,
    nullPct: Math.round(Number(get(`${c.name}__null`) ?? 0) * 10000) / 100,
    distinct: Number(get(`${c.name}__distinct`) ?? 0),
    min: (get(`${c.name}__min`) as string | null) ?? null,
    max: (get(`${c.name}__max`) as string | null) ?? null,
  }));
  return { object: fqn, rows: Number(get('n') ?? 0), columns, worstNullPct: Math.max(0, ...columns.map((c) => c.nullPct)) };
}

/** Profiles every non-Bronze upstream object of a product (Bronze CDC noise is profiled on Silver). */
export async function profileProduct(pack: Pack, qs: QueryService, product: DataProduct): Promise<ObjectProfile[]> {
  const out: ObjectProfile[] = [];
  for (const o of upstreamObjects(pack, product).filter((x) => x.layer !== 'bronze')) out.push(await profileObject(pack, qs, o.fqn));
  return out;
}

export function profileSummary(p: ObjectProfile): { object: string; rows: number; columns: number; worstNullPct: number; notes: string } {
  const worst = p.columns.filter((c) => c.nullPct === p.worstNullPct && p.worstNullPct > 0).map((c) => c.column);
  return { object: p.object, rows: p.rows, columns: p.columns.length, worstNullPct: p.worstNullPct, notes: worst.length ? `nulls in ${worst.slice(0, 3).join(', ')}` : 'complete' };
}
