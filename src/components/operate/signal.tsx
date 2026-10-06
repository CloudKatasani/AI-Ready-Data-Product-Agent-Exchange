import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { copy } from '@/copy/en';

const ICON = { ok: CheckCircle2, warn: AlertTriangle, fail: XCircle } as const;
const TONE = { ok: 'text-certified', warn: 'text-degraded', fail: 'text-fail' } as const;

/** A health signal with icon and text (never colour alone). */
export function Signal({ value }: { value: 'ok' | 'warn' | 'fail' }) {
  const Icon = ICON[value];
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${TONE[value]}`} data-signal={value}>
      <Icon aria-hidden className="size-4" />
      <span className="text-foreground">{copy.operate.health.signal[value]}</span>
    </span>
  );
}

const STATE = { healthy: 'ok', degraded: 'warn', down: 'fail' } as const;

export function HealthState({ value }: { value: 'healthy' | 'degraded' | 'down' }) {
  const Icon = ICON[STATE[value]];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium ${TONE[STATE[value]]}`} data-health={value}>
      <Icon aria-hidden className="size-3.5" />
      <span className="text-foreground">{copy.operate.health.state[value]}</span>
    </span>
  );
}
