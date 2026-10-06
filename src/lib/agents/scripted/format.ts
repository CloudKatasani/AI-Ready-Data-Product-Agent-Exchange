/** Locale-aware number formatting by metric unit and decimals (pack locale/currency). */
export interface FormatSpec {
  locale: string;
  currency: string;
  unit?: string;
  decimals?: number;
}

export function formatValue(v: unknown, f: FormatSpec): string {
  if (v === null || v === undefined) return '—';
  if (typeof v !== 'number') return String(v);
  const d = f.decimals ?? 2;
  if (f.unit === 'USD' || f.unit === f.currency) {
    return new Intl.NumberFormat(f.locale, { style: 'currency', currency: f.currency, maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : d, minimumFractionDigits: Math.abs(v) >= 1000 ? 0 : d }).format(v);
  }
  const n = new Intl.NumberFormat(f.locale, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  if (f.unit === '%') return `${n}%`;
  return f.unit ? `${n} ${f.unit}` : n;
}

/** Rounds to the metric's decimals (golden comparisons and grounding tolerance use this). */
export function roundTo(v: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
}
