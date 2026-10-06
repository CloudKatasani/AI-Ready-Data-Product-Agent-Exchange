import { AccessChip, QualityRing, SensitivityChips, StatusChip } from '@/components/marketplace/chips';
import { copy } from '@/copy/en';
import type { ProductCard } from '@/lib/marketplace/catalog';
import type { Pack } from '@/lib/packs/schema';

/** Side-by-side comparison of up to 3 products: contract, SLA, quality, KPIs, consumption patterns. */
export function CompareTable({ cards, pack }: { cards: ProductCard[]; pack: Pack }) {
  if (cards.length === 0) return <p className="text-muted-foreground">{copy.marketplace.compareHint}</p>;
  const r = copy.marketplace.compareRows;
  const sla = (id: string) => pack.products.find((p) => p.id === id)?.sla;
  const rows: { label: string; cell: (c: ProductCard) => React.ReactNode }[] = [
    { label: r.status, cell: (c) => <StatusChip status={c.status} /> },
    { label: r.version, cell: (c) => `v${c.version}` },
    { label: r.owner, cell: (c) => c.owner },
    { label: r.quality, cell: (c) => <QualityRing score={c.quality?.score ?? null} size={40} /> },
    { label: r.freshness, cell: (c) => `≤ ${sla(c.id)?.freshness_minutes} ${copy.marketplace.minutes}` },
    { label: r.availability, cell: (c) => `${sla(c.id)?.availability_pct}%` },
    { label: r.nullRate, cell: (c) => `${sla(c.id)?.max_null_rate_pct}%` },
    { label: r.kpis, cell: (c) => c.kpis.map((k) => k.name).join(', ') },
    { label: r.patterns, cell: (c) => c.patterns.join(', ') },
    { label: r.sensitivity, cell: (c) => (c.sensitivity.length ? <SensitivityChips classes={c.sensitivity} /> : '—') },
    { label: r.agents, cell: (c) => c.agents.map((a) => a.name).join(', ') || '—' },
    { label: r.access, cell: (c) => <AccessChip access={c.access} /> },
  ];
  return (
    <div role="region" aria-label={copy.marketplace.tabs.compare} tabIndex={0} className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm" data-testid="compare-table">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 text-left" />
            {cards.map((c) => (
              <th key={c.id} scope="col" className="px-3 py-2 text-left font-semibold">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left font-medium text-muted-foreground">
                {row.label}
              </th>
              {cards.map((c) => (
                <td key={c.id} className="px-3 py-2 align-top">
                  {row.cell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
