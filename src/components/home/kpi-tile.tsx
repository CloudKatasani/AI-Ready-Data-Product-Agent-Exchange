import { Lock } from 'lucide-react';
import Link from 'next/link';
import { copy } from '@/copy/en';
import type { KpiTile } from '@/lib/presenter/home';
import { cn } from '@/lib/utils';

const TONE = { in_band: 'text-certified', better: 'text-certified', worse: 'text-degraded', unknown: 'text-muted-foreground' } as const;

function Sparkline({ points, label }: { points: (number | null)[]; label: string }) {
  const vals = points.filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const w = 120;
  const h = 32;
  const step = w / (points.length - 1);
  const y = (v: number) => (max === min ? h / 2 : h - ((v - min) / (max - min)) * (h - 4) - 2);
  const d = points.map((v, i) => (v === null ? '' : `${i === 0 || points[i - 1] === null ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`)).join('');
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="h-8 w-28" data-testid="sparkline">
      <path d={d} fill="none" stroke="var(--brand-primary)" strokeWidth={2} />
    </svg>
  );
}

function fmt(v: number, unit: string, locale: string, currency: string): string {
  if (unit === 'USD' || unit === currency) return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(v) >= 100 ? 1 : 2 }).format(v);
  return unit === '%' ? `${n}%` : `${n} ${unit}`;
}

/** Headline KPI tile: value over the KPI window, target band, 12-month sparkline, link to the Playground. */
export function KpiTileCard({ tile, packId, locale, currency, playgroundHref }: { tile: KpiTile; packId: string; locale: string; currency: string; playgroundHref: string }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm" data-testid="kpi-tile" data-kpi={tile.kpiId} data-value={tile.value ?? ''}>
      <h3 className="text-sm font-medium text-muted-foreground">{tile.name}</h3>
      {tile.denied ? (
        <p className="flex items-center gap-1.5 text-sm">
          <Lock aria-hidden className="size-4 text-degraded" />
          <Link className="underline" href={`/${packId}/marketplace/products/${tile.denied.productId ?? ''}`}>
            {copy.outcome.denied}
          </Link>
        </p>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums">{tile.value === null ? '—' : fmt(tile.value, tile.unit, locale, currency)}</p>
          <p className={cn('text-xs', TONE[tile.status])} data-status={tile.status}>
            {copy.home.band[tile.status]} · {copy.home.target} {fmt(tile.target.min, tile.unit, locale, currency)}–{fmt(tile.target.max, tile.unit, locale, currency)}
          </p>
          <Sparkline points={tile.spark.map((s) => s.value)} label={`${tile.name} trend`} />
          <Link href={playgroundHref} className="min-h-[24px] text-xs text-primary underline-offset-2 hover:underline">
            {copy.home.openInPlayground}
          </Link>
        </>
      )}
    </article>
  );
}
