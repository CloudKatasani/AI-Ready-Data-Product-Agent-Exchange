import type { TimeRange } from '@/lib/packs/schema';

/** Inclusive ISO date window. */
export interface ResolvedRange {
  from: string;
  to: string;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
const parts = (s: string) => s.split('-').map(Number) as [number, number, number];
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Resolves a relative window against the pack clock (ADR-0011): `last n unit` = the n most recent
 * complete units ending on or before asOf (asOf's own unit counts when asOf is its last day).
 */
export function resolveTimeRange(range: TimeRange, asOf: string): ResolvedRange | null {
  const [y, m, d] = parts(asOf);
  if (range.ytd) return { from: iso(y, 1, 1), to: asOf, label: `${y} year to date` };
  if (range.last) {
    const { n, unit } = range.last;
    if (unit === 'day') return { from: iso(y, m, d - n + 1), to: asOf, label: `last ${n} day${n > 1 ? 's' : ''}` };
    const size = unit === 'month' ? 1 : unit === 'quarter' ? 3 : 12;
    // End month (1-based) of the last complete unit.
    let endMonth: number;
    let endYear = y;
    if (unit === 'year') {
      endMonth = 12;
      if (!(m === 12 && d === 31)) endYear = y - 1;
    } else {
      const unitEndMonth = Math.ceil(m / size) * size;
      const complete = m === unitEndMonth && d === lastDayOfMonth(y, m);
      endMonth = complete ? unitEndMonth : unitEndMonth - size;
    }
    while (endMonth <= 0) {
      endMonth += 12;
      endYear -= 1;
    }
    const startMonthIndex = endYear * 12 + (endMonth - 1) - (n * size - 1);
    const sy = Math.floor(startMonthIndex / 12);
    const sm = (startMonthIndex % 12) + 1;
    const to = iso(endYear, endMonth, lastDayOfMonth(endYear, endMonth));
    const from = iso(sy, sm, 1);
    return { from, to, label: `last ${n > 1 ? `${n} ` : ''}${unit}${n > 1 ? 's' : ''}` };
  }
  if (range.from || range.to) return { from: range.from ?? '1900-01-01', to: range.to ?? asOf, label: `${range.from ?? '…'} to ${range.to ?? asOf}` };
  return null;
}
