/**
 * Mustache-like answer templates (04 §3.7): {{top.f}}, {{bottom.f}}, {{total.m}}, {{vsTarget.top}},
 * {{delta.m}}, {{rows}}. Values come only from governed results — never from the template text.
 */
import type { Kpi } from '@/lib/packs/schema';
import type { OutputField } from '@/lib/query/types';
import { formatValue } from './format';

export interface TemplateData {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  fields: OutputField[];
  /** System-level values for `total.*` (same filters, no dimensions). */
  totals: Record<string, number | null>;
  kpiFor: (metric: string) => Kpi | undefined;
  locale: string;
  currency: string;
}

/** Template values are bare numbers (the template text carries units); currency keeps its symbol. */
function fieldFormat(d: TemplateData, name: string) {
  const f = d.fields.find((x) => x.name === name);
  const currency = f?.unit === 'USD' || f?.unit === d.currency;
  return { locale: d.locale, currency: d.currency, unit: currency ? f?.unit : undefined, decimals: f?.decimals };
}

/** Plain-language position of a value against its KPI target band. */
export function vsTarget(value: number, kpi: Kpi | undefined): string {
  if (!kpi) return 'no target set for';
  if (value < kpi.target.min) return kpi.direction === 'lower_is_better' ? 'better than' : 'below';
  if (value > kpi.target.max) return kpi.direction === 'higher_is_better' ? 'better than' : 'above';
  return 'within';
}

export function renderTemplate(tpl: string, d: TemplateData): string {
  const col = (name: string) => d.columns.indexOf(name);
  const firstMetric = d.fields.find((f) => f.role === 'metric')?.name;
  return tpl.replace(/\{\{\s*([a-zA-Z]+)(?:\.([a-z_][a-z0-9_]*))?\s*\}\}/g, (_m, helper: string, field?: string) => {
    if (helper === 'rows') return String(d.rows.length);
    if ((helper === 'top' || helper === 'bottom') && field) {
      const row = helper === 'top' ? d.rows[0] : d.rows[d.rows.length - 1];
      const i = col(field);
      return i < 0 || !row ? '—' : formatValue(row[i], fieldFormat(d, field));
    }
    if (helper === 'total' && field) return formatValue(d.totals[field] ?? (d.rows.length === 1 ? d.rows[0]?.[col(field)] : null), fieldFormat(d, field));
    if (helper === 'vsTarget') {
      const m = firstMetric;
      // A multi-row result (trend, breakdown) compares its total to the target, not its first row.
      const v = m ? (d.rows.length > 1 && typeof d.totals[m] === 'number' ? d.totals[m] : d.rows[0]?.[col(m)]) : null;
      return typeof v === 'number' && m ? vsTarget(v, d.kpiFor(m)) : 'no target set for';
    }
    if (helper === 'delta' && field) {
      const i = col(field);
      const a = d.rows[0]?.[i];
      const b = d.rows[d.rows.length - 1]?.[i];
      if (typeof a !== 'number' || typeof b !== 'number') return '—';
      const diff = b - a;
      return `${diff >= 0 ? '+' : '−'}${formatValue(Math.abs(diff), fieldFormat(d, field))}`;
    }
    return '—';
  });
}

const COMPARATIVE = /\b(highest|lowest|most|fewest|largest|smallest|best|worst|ranks?|leads?|trails?)\b/i;
const ACROSS_ROWS = /\{\{\s*(bottom\.[^}]*|rows)\s*\}\}/;

/**
 * A comparative template ("X had the highest… Y was lowest… across N regions") reads wrongly when the
 * governed result has a single row, as when row access leaves one region. Then the headline states that
 * row's value plainly and the comparative sentences are dropped; rule and definition sentences stay.
 */
export function singleRowTemplates(headlineTpl: string, narrativeTpl: string, o: { slice: string; metric: string; label: string; unit: string; period: string }): { headline: string; narrative: string } | null {
  if (!COMPARATIVE.test(headlineTpl) && !ACROSS_ROWS.test(`${headlineTpl} ${narrativeTpl}`)) return null;
  const sentences = narrativeTpl.split(/(?<=[.!?])\s+/).filter((x) => x.trim() && !ACROSS_ROWS.test(x) && !COMPARATIVE.test(x));
  return { headline: `{{top.${o.slice}}} · ${o.label}${o.period ? ` ${o.period}` : ''}: {{top.${o.metric}}}${o.unit}.`, narrative: sentences.join(' ') };
}

/** "last quarter", "in the last 3 months", "this year" — the period a time range covers, for answer text. */
export function periodPhrase(range: { last?: { n: number; unit: string }; ytd?: boolean } | undefined): string {
  if (range?.ytd) return 'this year';
  if (range?.last) return range.last.n === 1 ? `last ${range.last.unit}` : `in the last ${range.last.n} ${range.last.unit}s`;
  return '';
}
