import Link from 'next/link';
import { copy } from '@/copy/en';
import type { ProductCard as Card } from '@/lib/marketplace/catalog';
import { AccessChip, QualityRing, SensitivityChips, StatusChip } from './chips';

export function ProductCardView({ card, packId, compareChecked }: { card: Card; packId: string; compareChecked?: boolean }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm" data-testid="product-card" data-product={card.id}>
      <div className="flex items-start gap-3">
        <QualityRing score={card.quality?.score ?? null} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">
            <Link href={`/${packId}/marketplace/products/${card.id}`} className="hover:underline">
              {card.name}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {card.domain} · {card.id} · v{card.version}
          </p>
        </div>
        <AccessChip access={card.access} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{card.description}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <StatusChip status={card.status} />
        {card.quality && <span className="rounded-full border border-border px-2 py-0.5 capitalize">{card.quality.tier}</span>}
        <SensitivityChips classes={card.sensitivity} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{copy.marketplace.freshness}</dt>
        <dd>
          ≤ {card.freshnessMinutes} {copy.marketplace.minutes}
        </dd>
        <dt className="text-muted-foreground">{copy.marketplace.consumers}</dt>
        <dd className="truncate" title={card.consumers.join(', ')}>
          {card.consumers.length}
        </dd>
        <dt className="text-muted-foreground">{copy.marketplace.kpis}</dt>
        <dd>{card.kpis.length}</dd>
      </dl>
      <div className="mt-auto flex items-center gap-2">
        <span className="sr-only">
          {copy.marketplace.agents}: {card.agents.map((a) => a.name).join(', ') || '—'}
        </span>
        <span className="flex -space-x-1" aria-hidden>
          {card.agents.map((a) => (
            <span key={a.id} title={a.name} className="size-5 rounded-full border-2 border-surface" style={{ background: `hsl(${a.hue} 60% 45%)` }} />
          ))}
        </span>
        <label className="ml-auto inline-flex min-h-[24px] items-center gap-1 text-xs">
          <input type="checkbox" name="compare" value={card.id} defaultChecked={compareChecked} className="size-4" />
          {copy.marketplace.compareAdd}
        </label>
      </div>
    </article>
  );
}
