import { viewFields, type PackIndex } from '../index-pack';
import type { MetricQuery } from '../schema';
import type { Checks } from './types';

/** Validates a MetricQuery's names against its semantic view (shared by VQs, scenarios, knockout). */
export function checkMetricQuery(c: Checks, idx: PackIndex, q: MetricQuery, where: string, allowedViews?: ReadonlySet<string>): void {
  const view = idx.views.get(q.view);
  if (!c.expect(Boolean(view), 'ref.query.view', `${where}: unknown semantic view "${q.view}"`, where) || !view) return;
  if (allowedViews) c.expect(allowedViews.has(q.view), 'ref.query.agent_view', `${where}: view ${q.view} is not bound to the agent's semantic_query tool`, where);
  const f = viewFields(view);
  for (const m of q.metrics) c.expect(f.metrics.has(m), 'ref.query.metric', `${where}: metric "${m}" not in ${q.view}`, where);
  for (const d of q.dimensions ?? []) c.expect(f.dimensions.has(d), 'ref.query.dimension', `${where}: dimension "${d}" not in ${q.view}`, where);
  for (const fl of q.filters ?? []) c.expect(f.dimensions.has(fl.dimension) || f.time.has(fl.dimension), 'ref.query.filter', `${where}: filter dimension "${fl.dimension}" not in ${q.view}`, where);
  const fields = new Set([...q.metrics, ...(q.dimensions ?? []), 'period']);
  for (const o of q.orderBy ?? []) c.expect(fields.has(o.field), 'ref.query.order_by', `${where}: orderBy "${o.field}" is not a selected metric/dimension`, where);
  if (q.timeRange || q.timeGrain) {
    c.expect(view.time_dimensions.length > 0, 'ref.query.time', `${where}: ${q.view} has no time dimension but the query sets timeRange/timeGrain`, where);
  }
}
