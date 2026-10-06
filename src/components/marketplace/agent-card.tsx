import { Bot } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { copy } from '@/copy/en';
import type { AgentCard as Card } from '@/lib/marketplace/catalog';
import { AccessChip } from './chips';

export function AgentCardView({ card, packId }: { card: Card; packId: string }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm" data-testid="agent-card" data-agent={card.id}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: `hsl(${card.hue} 60% 40%)` }}>
          <Bot aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">
            <Link href={`/${packId}/marketplace/agents/${card.id}`} className="hover:underline">
              {card.name}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {card.domain} · {copy.marketplace.agentStatus[card.status]}
          </p>
        </div>
        <AccessChip access={card.access} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{card.capability}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{copy.marketplace.products}</dt>
        <dd className="truncate" title={card.products.map((p) => p.name).join(', ')}>
          {card.products.length}
        </dd>
        <dt className="text-muted-foreground">{copy.marketplace.kpis}</dt>
        <dd>{card.kpiCount}</dd>
        <dt className="text-muted-foreground">{copy.marketplace.costPerAnswer}</dt>
        <dd>${card.costPerAnswer.toFixed(2)}</dd>
        <dt className="text-muted-foreground">{copy.marketplace.evalTarget}</dt>
        <dd>{Math.round(card.evalGoldenMin * 100)}%</dd>
      </dl>
      <Link href={`/${packId}/ask/${card.id}`} className={`${buttonVariants({ size: 'sm' })} mt-auto self-start`}>
        {copy.marketplace.ask}
      </Link>
    </article>
  );
}
