import { EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Cell = string | number | boolean | null;

export interface GridColumn {
  name: string;
  label?: string;
  unit?: string;
  decimals?: number;
}

function format(v: Cell, col: GridColumn, locale: string): string {
  if (v === null) return '∅';
  if (typeof v === 'number') return new Intl.NumberFormat(locale, { maximumFractionDigits: col.decimals ?? 2, minimumFractionDigits: col.decimals ?? 0 }).format(v);
  return String(v);
}

/** Result grid; masked columns render as policy-styled cells with the policy named in the tooltip. */
export function DataGrid({ columns, rows, masked = [], maskPolicy = {}, locale = 'en-US', caption }: { columns: GridColumn[]; rows: Cell[][]; masked?: string[]; maskPolicy?: Record<string, string>; locale?: string; caption?: string }) {
  return (
    // Scrollable regions must be keyboard reachable (WCAG 2.1.1).
    <div role="region" aria-label={caption ?? 'Results'} tabIndex={0} className="max-h-[32rem] overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm" data-testid="data-grid">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 bg-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.name} scope="col" className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-semibold">
                <span className="inline-flex items-center gap-1">
                  {c.label ?? c.name}
                  {c.unit && <span className="font-normal text-muted-foreground">({c.unit})</span>}
                  {masked.includes(c.name) && <EyeOff aria-label="masked column" className="size-3.5 text-degraded" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-surface even:bg-background">
              {columns.map((c, j) => {
                const isMasked = masked.includes(c.name);
                const v = r[j] ?? null;
                return (
                  <td
                    key={c.name}
                    data-masked={isMasked || undefined}
                    title={isMasked ? `Masked by ${maskPolicy[c.name] ?? 'masking policy'}` : undefined}
                    className={cn('whitespace-nowrap border-b border-border px-3 py-1.5', typeof v === 'number' && 'text-right tabular-nums', isMasked && 'italic text-degraded')}
                  >
                    {format(v, c, locale)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
