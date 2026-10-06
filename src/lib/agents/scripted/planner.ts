/**
 * Coverage planner (08 §3.3) — TS translation of the marketplace `planner.py` idea: detect a covered KPI,
 * slice, grain, window, ranking, target and filter words in free text and build a MetricQuery.
 * Pack-driven: every word list it matches against comes from the pack (KPIs, metrics, dimensions,
 * synonyms, regions); only generic English analysis words live here.
 */
import type { AgentManifest, Kpi, MetricQuery, Pack, SemanticView, TimeRange } from '@/lib/packs/schema';
import { mentions, normalise, tokens } from './text';

export interface Plan {
  query: MetricQuery;
  kpi: Kpi;
  view: SemanticView;
  headline: string;
  narrative: string;
  chart: 'bar' | 'line' | 'table' | 'kpi';
}

const GRAIN_WORDS: [RegExp, NonNullable<MetricQuery['timeGrain']>][] = [
  [/\b(daily|per day|by day|each day)\b/, 'day'],
  [/\b(weekly|per week|by week)\b/, 'week'],
  [/\b(monthly|per month|by month|month by month|each month)\b/, 'month'],
  [/\b(quarterly|per quarter|by quarter|quarter by quarter|each quarter)\b/, 'quarter'],
  [/\b(yearly|annual|annually|per year|by year|year by year)\b/, 'year'],
];
const TREND = /\b(trend|over time|trending|history|moved|movement)\b/;
const TOP = /\b(top|highest|most|largest|biggest|worst|best|lowest|least|bottom|fewest|smallest)\b(?:\s+(\d{1,2}))?/;
const ASC_WORDS = /\b(lowest|least|bottom|fewest|smallest)\b/;
const TARGET = /\b(target|on track|within (the )?band|regulatory limit|goal)\b/;
const SHARE = /\b(share|contribution|contribute|breakdown|mix|split)\b/;
const SPREAD = /\b(distribution|distributed|spread|percentile|median)\b/;

function windowFor(q: string): TimeRange | undefined {
  const n = normalise(q);
  const lastN = /\blast (\d{1,2}) (month|quarter|year)s?\b/.exec(n);
  if (lastN) return { last: { n: Number(lastN[1]), unit: lastN[2] as 'month' | 'quarter' | 'year' } };
  if (/\b(ytd|year to date|this year|so far this year)\b/.test(n)) return { ytd: true };
  if (/\blast (quarter|qtr)\b/.test(n)) return { last: { n: 1, unit: 'quarter' } };
  if (/\blast month\b/.test(n)) return { last: { n: 1, unit: 'month' } };
  if (/\blast year\b/.test(n)) return { last: { n: 1, unit: 'year' } };
  if (/\blast 12 months\b/.test(n)) return { last: { n: 12, unit: 'month' } };
  return undefined;
}

function phraseScore(question: string, phrases: string[]): number {
  let best = 0;
  for (const p of phrases) if (p && mentions(question, p)) best = Math.max(best, normalise(p).length);
  return best;
}

/** Best covered KPI for the question (longest matching name/label/synonym/term phrase). */
export function detectKpi(pack: Pack, agent: AgentManifest, question: string): Kpi | undefined {
  let best: { kpi: Kpi; score: number } | undefined;
  for (const c of agent.kpi_coverage) {
    const kpi = pack.kpis.find((k) => k.id === c.kpi);
    if (!kpi) continue;
    const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === kpi.metric));
    const metric = view?.metrics.find((m) => m.name === kpi.metric);
    const term = pack.glossary.find((t) => t.id === kpi.term);
    const syn = pack.synonyms.filter((s) => s.maps_to.kind === 'metric' && s.maps_to.ref === kpi.metric).flatMap((s) => [s.term, ...s.synonyms]);
    const phrases = [kpi.name, metric?.label ?? '', ...(metric?.synonyms ?? []), ...(term && term.mappings.metrics.length <= 1 ? [term.name, ...term.synonyms] : []), ...syn];
    const score = phraseScore(question, phrases);
    if (score > 0 && (!best || score > best.score)) best = { kpi, score };
  }
  return best?.kpi;
}

/** True when any phrase naming the metric (label, synonyms, KPI name, term) has all its words in the question. */
export function metricMentioned(pack: Pack, metricName: string, question: string): boolean {
  const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === metricName));
  const metric = view?.metrics.find((m) => m.name === metricName);
  const kpi = pack.kpis.find((k) => k.metric === metricName);
  const term = pack.glossary.find((t) => t.id === metric?.term);
  const qt = new Set(tokens(question));
  return [metric?.label ?? '', ...(metric?.synonyms ?? []), kpi?.name ?? '', ...(term ? [term.name, ...term.synonyms] : [])].some((p) => {
    if (mentions(question, p)) return true;
    const pt = tokens(p);
    // A phrase that relies on a stop word ("in …") must appear verbatim — dropping it changes meaning.
    if (pt.length !== normalise(p).split(' ').filter(Boolean).length) return false;
    return pt.length > 0 && pt.every((t) => qt.has(t));
  });
}

function dimensionPhrases(view: SemanticView, name: string): string[] {
  const d = view.dimensions.find((x) => x.name === name);
  return d ? [d.name.replace(/_/g, ' '), d.label ?? '', ...d.synonyms] : [];
}

/** A slice the question asks for, restricted to the agent's coverage slices. */
function detectSlice(view: SemanticView, allowed: string[], question: string): string | undefined {
  const qt = new Set(tokens(question));
  let best: { name: string; score: number } | undefined;
  for (const name of allowed) {
    for (const phrase of dimensionPhrases(view, name)) {
      const pt = tokens(phrase);
      if (pt.length && pt.every((t) => qt.has(t))) {
        const score = pt.join(' ').length;
        if (!best || score > best.score) best = { name, score };
      }
    }
  }
  return best?.name;
}

/** Value filters: pack regions and value-synonyms ("tree contact" → cause = Tree contact). */
function detectFilters(pack: Pack, view: SemanticView, question: string): MetricQuery['filters'] {
  const filters: NonNullable<MetricQuery['filters']> = [];
  if (view.dimensions.some((d) => d.name === 'region')) {
    for (const r of pack.manifest.regions) if (new RegExp(`\\b(in|for|across) (the )?${r.toLowerCase()}\\b`).test(normalise(question))) filters.push({ dimension: 'region', op: '=', value: r });
  }
  for (const s of pack.synonyms.filter((x) => x.maps_to.kind === 'value')) {
    const [dim, value] = s.maps_to.ref.split('=');
    if (!dim || value === undefined || !view.dimensions.some((d) => d.name === dim)) continue;
    if ([s.term, ...s.synonyms].some((p) => mentions(question, p)) && !filters.some((f) => f.dimension === dim)) filters.push({ dimension: dim, op: '=', value });
  }
  return filters.length ? filters : undefined;
}

/** Plans a MetricQuery within coverage, or returns null (→ help/decline upstream). */
export function plan(pack: Pack, agent: AgentManifest, question: string): Plan | null {
  const kpi = detectKpi(pack, agent, question);
  if (!kpi) return null;
  const coverage = agent.kpi_coverage.find((c) => c.kpi === kpi.id);
  const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === kpi.metric));
  const metric = view?.metrics.find((m) => m.name === kpi.metric);
  if (!coverage || !view || !metric) return null;
  // Words that belong to the metric's own name (e.g. a "Daily …" metric) are not analysis words.
  const packSyn = pack.synonyms.filter((x) => x.maps_to.kind === 'metric' && x.maps_to.ref === metric.name).flatMap((x) => [x.term, ...x.synonyms]);
  const metricPhrases = [kpi.name, metric.label, ...metric.synonyms, ...packSyn].map(normalise).filter(Boolean).sort((a, b) => b.length - a.length);
  const q = metricPhrases.reduce((acc, p) => acc.replace(new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' '), normalise(question));
  const hasTime = view.time_dimensions.length > 0;

  let grain = GRAIN_WORDS.find(([re]) => re.test(q))?.[1];
  if (!grain && TREND.test(q) && hasTime) grain = (coverage.grains[0] as typeof grain) ?? 'month';
  if (grain && (!hasTime || (coverage.grains.length && !coverage.grains.includes(grain)))) grain = coverage.grains[0] as typeof grain;
  const slice = detectSlice(view, coverage.slices, question);
  const top = TOP.exec(q);
  const filters = detectFilters(pack, view, question)?.filter((f) => f.dimension !== slice);
  const range = hasTime ? (windowFor(question) ?? (Object.keys(kpi.window).length ? kpi.window : undefined)) : undefined;

  let analysis: MetricQuery['analysis'] = 'value';
  if (grain) analysis = 'trend';
  else if (slice && SPREAD.test(q)) analysis = 'distribution';
  else if (slice && SHARE.test(q)) analysis = 'contribution';
  else if (slice && top) analysis = 'rank';
  else if (TARGET.test(q) && !slice) analysis = 'compare_target';

  // Ranking direction: "lowest/bottom…" ascend; "worst"/"best" depend on whether higher is better.
  const word = top?.[1] ?? '';
  let dir: 'asc' | 'desc' = 'desc';
  if (ASC_WORDS.test(word)) dir = 'asc';
  else if (word === 'worst') dir = metric.direction === 'higher_is_better' ? 'asc' : 'desc';
  else if (word === 'best') dir = metric.direction === 'lower_is_better' ? 'asc' : 'desc';

  const query: MetricQuery = {
    view: view.name,
    metrics: [metric.name],
    ...(slice && analysis !== 'trend' ? { dimensions: [slice] } : {}),
    ...(grain ? { timeGrain: grain } : {}),
    ...(range ? { timeRange: range } : {}),
    ...(filters ? { filters } : {}),
    ...(slice && analysis !== 'distribution' && analysis !== 'trend' ? { orderBy: [{ field: metric.name, dir }] } : {}),
    ...(analysis === 'rank' ? { limit: Number(top?.[2] ?? 5) } : {}),
    analysis,
  };

  const u = metric.unit === '%' ? '%' : metric.unit === 'USD' || metric.unit === pack.manifest.currency ? '' : ` ${metric.unit}`;
  const sliceLabel = slice ? (view.dimensions.find((d) => d.name === slice)?.label ?? slice).toLowerCase() : '';
  const t = (field: string) => `{{top.${field}}}`;
  const tv = (field: string) => `{{top.${field}}}${u}`;
  let headline: string;
  let narrative: string;
  let chart: Plan['chart'] = 'kpi';
  switch (analysis) {
    case 'trend':
      headline = `${metric.label} moved by {{delta.${metric.name}}}${u} across the ${grain} periods shown.`;
      narrative = `It was ${tv(metric.name)} in the first period and {{bottom.${metric.name}}}${u} in the latest.`;
      chart = 'line';
      break;
    case 'distribution':
      headline = `Across ${t(`${slice}_count`)} ${sliceLabel} values, the median ${metric.label} is ${tv(`${metric.name}_p50`)}.`;
      narrative = `The middle 80% sit between ${tv(`${metric.name}_p10`)} and ${tv(`${metric.name}_p90`)}.`;
      chart = 'table';
      break;
    case 'contribution':
      headline = `${t(slice ?? '')} contributes the largest share of ${metric.label}: ${t(`${metric.name}_share_pct`)}%.`;
      narrative = `Total ${metric.label} is {{total.${metric.name}}}${u} across {{rows}} ${sliceLabel} values.`;
      chart = 'bar';
      break;
    case 'rank':
      headline = `${t(slice ?? '')} ranks first on ${metric.label} at ${tv(metric.name)}.`;
      narrative = `Showing {{rows}} ${sliceLabel} values ordered by ${metric.label}; overall it is {{total.${metric.name}}}${u}.`;
      chart = 'bar';
      break;
    case 'compare_target':
      headline = `${metric.label} is ${tv(metric.name)} — {{vsTarget.top}} the target band.`;
      narrative = `${kpi.name}: ${kpi.definition}.`;
      break;
    default:
      if (slice) {
        headline = `${t(slice)} has the highest ${metric.label} at ${tv(metric.name)}.`;
        narrative = `Overall ${metric.label} is {{total.${metric.name}}}${u} across {{rows}} ${sliceLabel} values.`;
        chart = 'bar';
      } else {
        headline = `${metric.label} is ${tv(metric.name)}.`;
        narrative = `${kpi.name}: ${kpi.definition}.`;
      }
  }
  return { query, kpi, view, headline, narrative, chart };
}
