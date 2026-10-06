import { EyeOff, Filter, KeyRound, PowerOff, ScrollText, Timer } from 'lucide-react';
import type { PolicyApplication } from '@/lib/query/types';

const ICON = { entitlement: KeyRound, row_access: Filter, masking: EyeOff, incident: Timer, limit: Timer, rule: ScrollText, knockout: PowerOff } as const;
const TONE: Record<PolicyApplication['kind'], string> = {
  entitlement: 'border-human text-human',
  row_access: 'border-in-certification text-in-certification',
  masking: 'border-degraded text-degraded',
  incident: 'border-fail text-fail',
  limit: 'border-border text-muted-foreground',
  rule: 'border-accent text-accent',
  knockout: 'border-fail text-fail',
};

/** Governance made visible (07 §1.3): one chip per applied policy, deduplicated. */
export function PolicyChips({ policies }: { policies: PolicyApplication[] }) {
  const seen = new Set<string>();
  const unique = policies.filter((p) => {
    const k = `${p.kind}|${p.ruleOrPolicyId ?? p.detail}`;
    return !seen.has(k) && seen.add(k);
  });
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Policies applied" data-testid="policy-chips">
      {unique.map((p, i) => {
        const Icon = ICON[p.kind];
        return (
          <li key={i} title={`${p.target}: ${p.detail}`} data-policy={p.kind} className={`inline-flex items-center gap-1 rounded-full border bg-surface px-2.5 py-0.5 text-xs font-medium ${TONE[p.kind]}`}>
            <Icon aria-hidden className="size-3.5" />
            {p.ruleOrPolicyId ? `${p.ruleOrPolicyId} · ` : ''}
            {p.detail}
          </li>
        );
      })}
    </ul>
  );
}
