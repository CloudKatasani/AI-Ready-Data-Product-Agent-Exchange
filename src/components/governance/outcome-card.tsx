import { Lock, Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { copy } from '@/copy/en';
import type { GovernedOutcome } from '@/lib/presenter/governed';

/** Calm card for a governed query that did not return data (07 §6): what happened, what to do next. */
export function OutcomeCard({ outcome, pack }: { outcome: Exclude<GovernedOutcome, { ok: true }>; pack: string }) {
  const Icon = outcome.kind === 'denied' ? Lock : outcome.kind === 'rejected' ? TriangleAlert : Info;
  return (
    <Card data-testid={`outcome-${outcome.kind}`} role="status">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon aria-hidden className="size-5 text-degraded" />
          {copy.outcome[outcome.kind]}
        </CardTitle>
        <CardDescription>{outcome.message}</CardDescription>
      </CardHeader>
      {(outcome.kind === 'rejected' || (outcome.kind === 'denied' && outcome.requestable && outcome.productId)) && (
        <CardContent className="text-sm">
          {outcome.kind === 'rejected' && <p>{outcome.hint}</p>}
          {outcome.kind === 'denied' && outcome.productId && (
            <Link className={buttonVariants({ size: 'sm', variant: 'outline' })} href={`/${pack}/marketplace/products/${outcome.productId}`}>
              {copy.outcome.request}
            </Link>
          )}
        </CardContent>
      )}
    </Card>
  );
}
