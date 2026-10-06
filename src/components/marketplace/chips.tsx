import { CheckCircle2, Clock, Lock, Unlock } from 'lucide-react';
import { copy } from '@/copy/en';
import type { AccessBadge, ProductStatus } from '@/lib/marketplace/catalog';
import { cn } from '@/lib/utils';

// Text stays foreground-coloured (WCAG contrast); the status colour carries on the border and dot.
const STATUS_TONE: Record<ProductStatus, string> = {
  CERTIFIED: 'border-certified',
  IN_CERTIFICATION: 'border-in-certification',
  IN_DEVELOPMENT: 'border-draft',
  DRAFT: 'border-draft',
  DEPRECATED: 'border-degraded',
  RETIRED: 'border-border',
};
const STATUS_DOT: Record<ProductStatus, string> = {
  CERTIFIED: 'bg-certified',
  IN_CERTIFICATION: 'bg-in-certification',
  IN_DEVELOPMENT: 'bg-draft',
  DRAFT: 'bg-draft',
  DEPRECATED: 'bg-degraded',
  RETIRED: 'bg-muted-foreground',
};

export function StatusChip({ status }: { status: ProductStatus }) {
  return (
    <span data-status={status} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground', STATUS_TONE[status])}>
      <span aria-hidden className={cn('size-2 rounded-full', STATUS_DOT[status])} />
      {copy.marketplace.status[status]}
    </span>
  );
}

const ACCESS_ICON = { Granted: CheckCircle2, Pending: Clock, Requestable: Unlock, Restricted: Lock } as const;
const ACCESS_TONE: Record<AccessBadge, string> = {
  Granted: 'border-certified [&>svg]:text-certified',
  Pending: 'border-in-certification [&>svg]:text-in-certification',
  Requestable: 'border-primary [&>svg]:text-primary',
  Restricted: 'border-degraded [&>svg]:text-degraded',
};

export function AccessChip({ access }: { access: AccessBadge }) {
  const Icon = ACCESS_ICON[access];
  return (
    <span data-testid="access-badge" data-access={access} className={cn('inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-xs font-medium text-foreground', ACCESS_TONE[access])}>
      <Icon aria-hidden className="size-3.5" />
      {copy.marketplace.access[access]}
    </span>
  );
}

export function SensitivityChips({ classes }: { classes: string[] }) {
  if (!classes.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {classes.map((c) => (
        <span key={c} className="rounded border border-degraded px-1.5 text-[11px] font-medium text-foreground" title="Sensitive data class">
          {c}
        </span>
      ))}
    </span>
  );
}

/** 0–100 quality ring; the value is the latest QualityScoreSnapshot (AC3.3). */
export function QualityRing({ score, size = 48 }: { score: number | null; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const v = score ?? 0;
  const tone = score === null ? 'var(--color-muted-foreground)' : v >= 95 ? 'var(--color-certified)' : v >= 80 ? 'var(--color-in-certification)' : 'var(--color-degraded)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={score === null ? copy.marketplace.noQuality : `${copy.marketplace.quality} ${v}`} data-testid="quality-ring" data-score={score ?? ''}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={4} strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="round" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 3.6} fontWeight={600} fill="currentColor">
        {score === null ? '—' : Math.round(v)}
      </text>
    </svg>
  );
}
