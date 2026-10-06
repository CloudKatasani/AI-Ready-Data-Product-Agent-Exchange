/**
 * Metric compiler (05 §1) — the ONLY producer of metric SQL (invariant I03). MetricQuery + pack →
 * DuckDB SQL with bound parameters. Knockout rewrites arrive in Phase 8.
 */
import type { MetricQuery, Pack, SemanticView } from '@/lib/packs/schema';
import type { CellValue } from '@/lib/warehouse/adapter';
import { type ResolvedRange, resolveTimeRange } from './time';
import type { OutputField } from './types';

export type Shape = 'value' | 'by_dimension' | 'trend' | 'rank' | 'contribution' | 'distribution' | 'compare_target';

export interface SourceRef {
  alias: string;
  fqn: string;
}

export interface CompileOptions {
  /** Question text; business rules are skipped when it mentions their `unless_question_mentions` phrases. */
  question?: string;
  /** Rule ids to skip explicitly (live tool arg `include_excluded`). */
  includeExcluded?: string[];
  /** Dimensions the principal is row-filtered on (forces bound tables into the join, picks scope denominators). */
  rowFilterDims?: string[];
  maxRows?: number;
}

export interface RenderHooks {
  /** FROM item for each table (the policy engine wraps row-filtered tables). Default `fqn alias`. */
  source?: (ref: SourceRef) => string;
  /** Projection of a dimension column (the policy engine applies masking). Grouping stays on the raw value. */
  project?: (field: OutputField, expr: string) => string;
}

export interface CompiledQuery {
  view: string;
  shape: Shape;
  sources: SourceRef[];
  render: (hooks?: RenderHooks) => string;
  sql: string;
  params: CellValue[];
  fields: OutputField[];
  fqnsTouched: string[];
  productIds: string[];
  metricRefs: { view: string; metric: string; term: string }[];
  ruleRefs: string[];
  rulesSkipped: string[];
  timeRange: ResolvedRange | null;
  limit: number;
}

export class CompileError extends Error {
  constructor(
    message: string,
    readonly code: 'UNKNOWN_FIELD' | 'INVALID',
    readonly suggestions: string[] = [],
  ) {
    super(message);
    this.name = 'CompileError';
  }
}

const ALIAS_REF = /\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g;
const DEFAULT_MAX_ROWS = 500;

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0] as number;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j] as number;
      dp[j] = Math.min((dp[j] as number) + 1, (dp[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length] as number;
}

/** Closest names, also matching synonyms (fed back to the LLM as a tool error). */
export function suggest(name: string, candidates: { name: string; synonyms?: string[] }[]): string[] {
  const n = name.toLowerCase();
  return candidates
    .map((c) => ({ c: c.name, d: Math.min(levenshtein(n, c.name), ...(c.synonyms ?? []).map((s) => levenshtein(n, s.toLowerCase().replace(/\s+/g, '_')))) }))
    .filter((x) => x.d <= Math.max(3, Math.floor(n.length / 2)))
    .sort((a, b) => a.d - b.d || a.c.localeCompare(b.c))
    .slice(0, 3)
    .map((x) => x.c);
}

const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;

function aliasesIn(expr: string): string[] {
  return [...expr.matchAll(ALIAS_REF)].map((m) => m[1] as string);
}

/** Tables to join: the fact, every alias an expression needs, and the tree path to each (BFS from the fact). */
function joinPlan(view: SemanticView, needed: Set<string>): { sources: SourceRef[]; joins: { ref: SourceRef; on: string }[] } {
  const [fact] = view.tables;
  if (!fact) throw new CompileError(`${view.name} has no tables`, 'INVALID');
  const byAlias = new Map(view.tables.map((t) => [t.alias, t]));
  const parent = new Map<string, { from: string; on: string }>();
  const queue = [fact.alias];
  const seen = new Set([fact.alias]);
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const r of view.relationships) {
      const [fa, fc] = r.from.split('.') as [string, string];
      const [ta, tc] = r.to.split('.') as [string, string];
      const step = fa === cur ? { far: ta, on: `${cur}.${fc} = ${ta}.${tc}` } : ta === cur ? { far: fa, on: `${cur}.${tc} = ${fa}.${fc}` } : null;
      if (!step || seen.has(step.far)) continue;
      seen.add(step.far);
      parent.set(step.far, { from: cur, on: step.on });
      queue.push(step.far);
    }
  }
  const include = new Set([fact.alias]);
  for (const a of needed) {
    if (!byAlias.has(a)) throw new CompileError(`${view.name}: expression uses unknown alias "${a}"`, 'INVALID');
    let cur: string | undefined = a;
    while (cur && !include.has(cur)) {
      include.add(cur);
      cur = parent.get(cur)?.from;
    }
  }
  const ordered = [...seen].filter((a) => include.has(a));
  const ref = (a: string): SourceRef => ({ alias: a, fqn: (byAlias.get(a) as { fqn: string }).fqn });
  return {
    sources: ordered.map(ref),
    joins: ordered.slice(1).map((a) => ({ ref: ref(a), on: (parent.get(a) as { on: string }).on })),
  };
}

function inferShape(q: MetricQuery): Shape {
  if (q.analysis === 'trend' || (!q.analysis && q.timeGrain)) return 'trend';
  if (q.analysis === 'rank') return 'rank';
  if (q.analysis === 'contribution') return 'contribution';
  if (q.analysis === 'distribution') return 'distribution';
  if (q.analysis === 'compare_target') return 'compare_target';
  if (q.dimensions?.length) return q.limit && q.limit <= 20 ? 'rank' : 'by_dimension';
  return 'value';
}

const OPS: Record<string, string> = { '=': '=', '!=': '<>', '>': '>', '<': '<', '>=': '>=', '<=': '<=' };

export function compileMetricQuery(q: MetricQuery, pack: Pack, opts: CompileOptions = {}): CompiledQuery {
  const view = pack.semantic.find((v) => v.name === q.view);
  if (!view) throw new CompileError(`Unknown semantic view "${q.view}"`, 'UNKNOWN_FIELD', suggest(q.view, pack.semantic.map((v) => ({ name: v.name }))));
  if (q.metrics.length === 0) throw new CompileError('A metric query needs at least one metric', 'INVALID');

  const dimByName = new Map([...view.dimensions, ...view.time_dimensions].map((d) => [d.name, d]));
  const metrics = q.metrics.map((name) => {
    const m = view.metrics.find((x) => x.name === name);
    if (!m) throw new CompileError(`Unknown metric "${name}" in ${view.name}`, 'UNKNOWN_FIELD', suggest(name, view.metrics));
    return m;
  });
  const dims = (q.dimensions ?? []).map((name) => {
    const d = view.dimensions.find((x) => x.name === name);
    if (!d) throw new CompileError(`Unknown dimension "${name}" in ${view.name}`, 'UNKNOWN_FIELD', suggest(name, view.dimensions));
    return d;
  });
  const timeDim = view.time_dimensions.find((t) => t.default) ?? view.time_dimensions[0];
  if ((q.timeGrain || q.timeRange) && !timeDim) throw new CompileError(`${view.name} has no time dimension`, 'INVALID');
  const shape = inferShape(q);
  if (shape === 'distribution' && dims.length === 0) throw new CompileError('A distribution needs a dimension to distribute over', 'INVALID');

  const params: CellValue[] = [];
  const bind = (v: unknown): string => {
    params.push(v as CellValue);
    return '?';
  };
  const where: string[] = [];
  const needed = new Set<string>();
  const needAliases = (expr: string) => aliasesIn(expr).forEach((a) => needed.add(a));

  // Filters on dimensions or time dimensions; user values are always bound parameters.
  for (const f of q.filters ?? []) {
    const d = dimByName.get(f.dimension);
    if (!d) throw new CompileError(`Unknown filter dimension "${f.dimension}" in ${view.name}`, 'UNKNOWN_FIELD', suggest(f.dimension, view.dimensions));
    needAliases(d.expr);
    const vals = Array.isArray(f.value) ? f.value : [f.value];
    if (f.op === 'in' || f.op === 'not in') where.push(`${d.expr} ${f.op === 'in' ? 'IN' : 'NOT IN'} (${vals.map(bind).join(', ')})`);
    else if (f.op === 'between') {
      if (vals.length !== 2) throw new CompileError(`between needs two values for ${f.dimension}`, 'INVALID');
      where.push(`${d.expr} BETWEEN ${bind(vals[0])} AND ${bind(vals[1])}`);
    } else where.push(`${d.expr} ${OPS[f.op]} ${bind(vals[0])}`);
  }

  // Business rules (default filters) unless the question or the caller opts out.
  const question = (opts.question ?? '').toLowerCase();
  const ruleRefs: string[] = [];
  const rulesSkipped: string[] = [];
  for (const m of metrics) {
    for (const { rule: id } of m.default_filters) {
      if (ruleRefs.includes(id) || rulesSkipped.includes(id)) continue;
      const rule = pack.rules.find((r) => r.id === id);
      if (!rule?.apply) continue;
      const skip = opts.includeExcluded?.includes(id) || rule.apply.unless_question_mentions.some((p) => question.includes(p.toLowerCase()));
      if (skip) {
        rulesSkipped.push(id);
        continue;
      }
      const d = dimByName.get(rule.apply.filter.dimension);
      if (!d) throw new CompileError(`Rule ${id} filters on "${rule.apply.filter.dimension}", not in ${view.name}`, 'INVALID');
      needAliases(d.expr);
      const f = rule.apply.filter;
      const vals = Array.isArray(f.value) ? f.value : [f.value];
      where.push(f.op === 'in' || f.op === 'not in' ? `${d.expr} ${f.op === 'in' ? 'IN' : 'NOT IN'} (${vals.map(bind).join(', ')})` : `${d.expr} ${OPS[f.op]} ${bind(vals[0])}`);
      ruleRefs.push(id);
    }
  }

  // Time range relative to pack.asOf (never the wall clock).
  const timeRange = q.timeRange ? resolveTimeRange(q.timeRange, pack.manifest.asOf) : null;
  if (timeRange && timeDim) {
    needAliases(timeDim.expr);
    where.push(`${timeDim.expr} BETWEEN CAST(${bind(timeRange.from)} AS DATE) AND CAST(${bind(timeRange.to)} AS DATE)`);
  }

  // Row-filtered principals: join every table bound to a row access policy on their dimension.
  const rowDims = new Set(opts.rowFilterDims ?? []);
  for (const rap of pack.policies.row_access_policies.filter((r) => rowDims.has(r.dimension))) {
    for (const t of view.tables) if (rap.bindings.some((b) => b.object === t.fqn)) needed.add(t.alias);
  }

  // Scope-aware metric expressions (e.g. ratio denominators per slice).
  const scopeDims = new Set([...dims.map((d) => d.name), ...(q.filters ?? []).map((f) => f.dimension), ...rowDims]);
  const metricExpr = (m: (typeof metrics)[number]) => m.scope_exprs.find((s) => scopeDims.has(s.dimension))?.expr ?? m.expr;

  const select: { expr: string; as: string; field?: OutputField }[] = [];
  const groupExprs: string[] = [];
  const fields: OutputField[] = [];
  const alias = new Map(view.tables.map((t) => [t.alias, t.fqn]));
  const lineageOf = (expr: string) => {
    const m = /^([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/.exec(expr.trim());
    return m ? `${alias.get(m[1] as string)}.${m[2]}` : undefined;
  };
  if (q.timeGrain && timeDim) {
    needAliases(timeDim.expr);
    const expr = `CAST(date_trunc('${q.timeGrain}', ${timeDim.expr}) AS DATE)`;
    select.push({ expr, as: 'period' });
    groupExprs.push(expr);
    fields.push({ name: 'period', role: 'period', label: q.timeGrain[0]?.toUpperCase() + q.timeGrain.slice(1) });
  }
  for (const d of dims) {
    needAliases(d.expr);
    const field: OutputField = { name: d.name, role: 'dimension', label: d.label ?? d.name, lineage: lineageOf(d.expr) };
    select.push({ expr: d.expr, as: d.name, field });
    groupExprs.push(d.expr);
    fields.push(field);
  }
  const groupCount = groupExprs.length;
  for (const m of metrics) {
    const expr = metricExpr(m);
    needAliases(expr);
    select.push({ expr, as: m.name });
    fields.push({ name: m.name, role: 'metric', label: m.label, unit: m.unit, decimals: m.decimals });
    if (shape === 'contribution') {
      select.push({ expr: `100.0 * (${expr}) / nullif(sum(${expr}) OVER (), 0)`, as: `${m.name}_share_pct` });
      fields.push({ name: `${m.name}_share_pct`, role: 'derived', label: `Share of ${m.label}`, unit: '%', decimals: 1 });
    }
    if (shape === 'compare_target') {
      const kpi = pack.kpis.find((k) => k.metric === m.name);
      if (kpi) {
        // Pack constants (numbers), inlined so positional parameters stay in textual order.
        select.push({ expr: `CAST(${Number(kpi.target.min)} AS DOUBLE)`, as: `${m.name}_target_min` }, { expr: `CAST(${Number(kpi.target.max)} AS DOUBLE)`, as: `${m.name}_target_max` });
        fields.push(
          { name: `${m.name}_target_min`, role: 'derived', label: `${m.label} target (min)`, unit: m.unit, decimals: m.decimals },
          { name: `${m.name}_target_max`, role: 'derived', label: `${m.label} target (max)`, unit: m.unit, decimals: m.decimals },
        );
      }
    }
  }

  const { sources, joins } = joinPlan(view, needed);
  const groupBy = groupCount > 0 ? `\nGROUP BY ${groupExprs.join(', ')}` : '';

  const outputNames = new Set(fields.map((f) => f.name));
  const order: string[] = [];
  for (const o of q.orderBy ?? []) {
    if (!outputNames.has(o.field)) throw new CompileError(`orderBy "${o.field}" is not a selected field`, 'UNKNOWN_FIELD', [...outputNames]);
    order.push(`${quoteIdent(o.field)} ${o.dir.toUpperCase()}`);
  }
  if (order.length === 0) {
    if (shape === 'trend') order.push('"period" ASC');
    else if (dims.length && metrics[0]) order.push(`${quoteIdent(metrics[0].name)} DESC`);
  }
  // Deterministic tie-break on every grouping column.
  // Deterministic tie-break on the raw grouping values (not the possibly masked projections).
  for (const g of groupExprs) order.push(`${g} ASC`);

  const cap = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const limit = Math.min(q.limit ?? (groupCount > 0 ? 50 : 1), cap);

  let distributionFields: OutputField[] | null = null;
  const render = (hooks: RenderHooks = {}): string => {
    const source = hooks.source ?? ((r: SourceRef) => `${r.fqn} ${r.alias}`);
    const project = hooks.project ?? ((_f: OutputField, e: string) => e);
    const cols = select.map((i) => `${i.field ? project(i.field, i.expr) : i.expr} AS ${quoteIdent(i.as)}`);
    const from = [`FROM ${source(sources[0] as SourceRef)}`, ...joins.map((j) => `JOIN ${source(j.ref)} ON ${j.on}`)].join('\n');
    const inner = `SELECT\n  ${cols.join(',\n  ')}\n${from}${where.length ? `\nWHERE ${where.join('\n  AND ')}` : ''}${groupBy}`;
    if (shape !== 'distribution') return `${inner}\nORDER BY ${order.length ? order.join(', ') : '1'}\nLIMIT ${limit}`;
    const [over, ...by] = dims;
    const byCols = by.map((d) => quoteIdent(d.name));
    const stats = metrics.flatMap((m) =>
      [
        ['p10', 'quantile_cont', 0.1],
        ['p50', 'quantile_cont', 0.5],
        ['p90', 'quantile_cont', 0.9],
      ].map(([suffix, fn, p]) => `${fn}(${quoteIdent(m.name)}, ${p}) AS ${quoteIdent(`${m.name}_${suffix}`)}`).concat(`min(${quoteIdent(m.name)}) AS ${quoteIdent(`${m.name}_min`)}`, `max(${quoteIdent(m.name)}) AS ${quoteIdent(`${m.name}_max`)}`),
    );
    const outer = [...byCols, `count(*) AS ${quoteIdent(`${over?.name}_count`)}`, ...stats];
    return `SELECT ${outer.join(', ')}\nFROM (\n${inner}\n) dist${byCols.length ? `\nGROUP BY ${byCols.join(', ')}\nORDER BY ${byCols.join(', ')}` : ''}\nLIMIT ${limit}`;
  };
  if (shape === 'distribution') {
    const [over, ...by] = dims;
    distributionFields = [
      ...fields.filter((f) => by.some((d) => d.name === f.name)),
      { name: `${over?.name}_count`, role: 'derived', label: `${over?.label ?? over?.name} count`, decimals: 0 },
      ...metrics.flatMap((m) =>
        ['p10', 'p50', 'p90', 'min', 'max'].map((s) => ({ name: `${m.name}_${s}`, role: 'derived' as const, label: `${m.label} ${s.toUpperCase()}`, unit: m.unit, decimals: m.decimals })),
      ),
    ];
  }

  const productIds = [...new Set([...view.products, ...pack.products.filter((p) => p.semantic_view === view.name).map((p) => p.id)])].sort();
  return {
    view: view.name,
    shape,
    sources,
    render,
    sql: render(),
    params,
    fields: distributionFields ?? fields,
    fqnsTouched: [...new Set(sources.map((s) => s.fqn))].sort(),
    productIds,
    metricRefs: metrics.map((m) => ({ view: view.name, metric: m.name, term: m.term })),
    ruleRefs,
    rulesSkipped,
    timeRange,
    limit,
  };
}
