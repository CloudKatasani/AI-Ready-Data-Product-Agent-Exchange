/**
 * Home KPI tiles (01 §M2): headline KPIs computed by the metric compiler through QueryService — the same
 * MetricQuery the Semantic Playground builds for the KPI's reporting window (AC2.1).
 */
import type { Kpi, MetricQuery, Pack } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';
import { PolicyDenied, type Principal } from '@/lib/query/types';

export interface KpiTile {
  kpiId: string;
  name: string;
  unit: string;
  value: number | null;
  target: { min: number; max: number };
  status: 'in_band' | 'better' | 'worse' | 'unknown';
  direction: Kpi['direction'];
  spark: { period: string; value: number | null }[];
  view: string;
  metric: string;
  denied?: { message: string; productId: string | null };
}

export function kpiView(pack: Pack, kpi: Kpi) {
  return pack.semantic.find((v) => v.metrics.some((m) => m.name === kpi.metric));
}

/** The KPI tile query: the metric over the KPI's reporting window (no dimensions). */
export function kpiTileQuery(pack: Pack, kpi: Kpi): MetricQuery | null {
  const view = kpiView(pack, kpi);
  if (!view) return null;
  const windowed = view.time_dimensions.length > 0 && Object.keys(kpi.window).length > 0;
  return { view: view.name, metrics: [kpi.metric], ...(windowed ? { timeRange: kpi.window } : {}) };
}

/** Sparkline: monthly values over the last 12 months (none when the view has no time dimension). */
export function kpiSparkQuery(pack: Pack, kpi: Kpi): MetricQuery | null {
  const view = kpiView(pack, kpi);
  if (!view || view.time_dimensions.length === 0) return null;
  return { view: view.name, metrics: [kpi.metric], timeGrain: 'month', timeRange: { last: { n: 12, unit: 'month' } }, analysis: 'trend' };
}

export function bandStatus(kpi: Kpi, value: number | null): KpiTile['status'] {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (value >= kpi.target.min && value <= kpi.target.max) return 'in_band';
  const above = value > kpi.target.max;
  if (kpi.direction === 'target_band') return 'worse';
  return (kpi.direction === 'higher_is_better') === above ? 'better' : 'worse';
}

export async function headlineTiles(pack: Pack, qs: QueryService, who: Principal): Promise<KpiTile[]> {
  const out: KpiTile[] = [];
  for (const id of pack.manifest.home.headlineKpis) {
    const kpi = pack.kpis.find((k) => k.id === id);
    const q = kpi ? kpiTileQuery(pack, kpi) : null;
    if (!kpi || !q) continue;
    const base = { kpiId: kpi.id, name: kpi.name, unit: kpi.unit, target: kpi.target, direction: kpi.direction, view: q.view, metric: kpi.metric };
    try {
      const r = await qs.run({ kind: 'metric', query: q, purpose: 'kpi-tile' }, who);
      const value = typeof r.rows[0]?.[0] === 'number' ? (r.rows[0][0] as number) : null;
      const sq = kpiSparkQuery(pack, kpi);
      const spark = sq ? (await qs.run({ kind: 'metric', query: sq, purpose: 'kpi-tile' }, who)).rows.map((row) => ({ period: String(row[0]), value: typeof row[1] === 'number' ? row[1] : null })) : [];
      out.push({ ...base, value, status: bandStatus(kpi, value), spark });
    } catch (e) {
      if (!(e instanceof PolicyDenied)) throw e;
      out.push({ ...base, value: null, status: 'unknown', spark: [], denied: { message: e.message, productId: e.productId } });
    }
  }
  return out;
}
