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
      const v = m ? d.rows[0]?.[col(m)] : null;
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
