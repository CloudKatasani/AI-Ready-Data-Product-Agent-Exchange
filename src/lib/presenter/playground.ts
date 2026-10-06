import type { MetricQuery, SemanticView, TimeRange } from '@/lib/packs/schema';

/** Semantic Playground URL state → MetricQuery (the same IR agents and KPI tiles compile). */
export const RANGES: Record<string, TimeRange | undefined> = {
  none: undefined,
  'last-month': { last: { n: 1, unit: 'month' } },
  'last-quarter': { last: { n: 1, unit: 'quarter' } },
  'last-4-quarters': { last: { n: 4, unit: 'quarter' } },
  ytd: { ytd: true },
  'last-year': { last: { n: 1, unit: 'year' } },
};

export interface PlaygroundParams {
  metric?: string;
  dim?: string;
  grain?: string;
  range?: string;
  fdim?: string;
  fval?: string;
}

function parseValue(v: string): string | number | boolean {
  if (v === 'true' || v === 'false') return v === 'true';
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}

export function playgroundQuery(view: SemanticView, p: PlaygroundParams): MetricQuery | null {
  if (!p.metric || !view.metrics.some((m) => m.name === p.metric)) return null;
  const hasTime = view.time_dimensions.length > 0;
  const grain = hasTime && ['day', 'week', 'month', 'quarter', 'year'].includes(p.grain ?? '') ? (p.grain as MetricQuery['timeGrain']) : undefined;
  const range = hasTime ? RANGES[p.range ?? 'none'] : undefined;
  return {
    view: view.name,
    metrics: [p.metric],
    ...(p.dim && view.dimensions.some((d) => d.name === p.dim) ? { dimensions: [p.dim] } : {}),
    ...(grain ? { timeGrain: grain } : {}),
    ...(range ? { timeRange: range } : {}),
    ...(p.fdim && p.fval && view.dimensions.some((d) => d.name === p.fdim) ? { filters: [{ dimension: p.fdim, op: '=' as const, value: parseValue(p.fval) }] } : {}),
  };
}

/** The Playground range key for a KPI reporting window, if one matches. */
export function rangeKeyFor(window: TimeRange): string | undefined {
  return Object.entries(RANGES).find(([, r]) => JSON.stringify(r ?? {}) === JSON.stringify(window))?.[0];
}
