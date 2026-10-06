/**
 * Knockout — "Why AI-Ready" (01 §M11; ported from AI-Ready `ext/knockout.ts`). Switch layers off and the
 * pack's four governed answers degrade: the compiler and QueryService rewrite the real query (naive
 * formula, dropped rules, Silver/Bronze sources, no policies), so every delta is computed, not scripted.
 * Failure types come from the pack (`failure_by_layer`).
 */
import { KNOCKOUT_LAYERS, type KnockoutLayer, type Pack } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';
import type { PolicyApplication, Principal } from '@/lib/query/types';

export type FailureType = 'wrong' | 'unsafe' | 'ambiguous' | 'unverified';

export interface KnockoutResult {
  id: string;
  kpi: string;
  question: string;
  metric: string;
  baseline: number | null;
  value: number | null;
  deltaPct: number | null;
  failures: { layer: KnockoutLayer; type: FailureType }[];
  confidence: 'trusted' | 'questionable' | 'unsafe';
  error: string | null;
  displaySql: string;
  policies: PolicyApplication[];
}

export const LAYER_ORDER: readonly KnockoutLayer[] = KNOCKOUT_LAYERS;

const round1 = (v: number) => Math.round(v * 10) / 10;

async function valueOf(qs: QueryService, who: Principal, a: Pack['knockout']['answers'][number], off: KnockoutLayer[]) {
  try {
    const r = await qs.run({ kind: 'metric', query: a.query, purpose: 'knockout', question: a.question, knockout: off }, who);
    const v = r.rows[0]?.[0];
    return { value: typeof v === 'number' ? v : v === null || v === undefined ? null : Number(v), displaySql: r.displaySql, policies: r.policiesApplied, error: null };
  } catch (e) {
    return { value: null, displaySql: '', policies: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Relative change, % with one decimal (null when either side is missing or the baseline is zero). */
export function deltaPct(baseline: number | null, value: number | null): number | null {
  if (baseline === null || value === null || !Number.isFinite(baseline) || !Number.isFinite(value) || baseline === 0) return null;
  return round1(((value - baseline) / Math.abs(baseline)) * 100);
}

export function confidenceFor(failures: { type: FailureType }[]): KnockoutResult['confidence'] {
  if (failures.some((f) => f.type === 'unsafe')) return 'unsafe';
  return failures.length ? 'questionable' : 'trusted';
}

/** The four knockout answers with `off` layers switched off, against the all-on baseline. */
export async function runKnockout(pack: Pack, qs: QueryService, who: Principal, off: KnockoutLayer[]): Promise<KnockoutResult[]> {
  const out: KnockoutResult[] = [];
  for (const a of pack.knockout.answers) {
    const base = await valueOf(qs, who, a, []);
    const now = off.length ? await valueOf(qs, who, a, off) : base;
    const failures = LAYER_ORDER.filter((l) => off.includes(l)).flatMap((layer) => {
      const type = a.failure_by_layer[layer];
      return type ? [{ layer, type }] : [];
    });
    out.push({
      id: a.id,
      kpi: a.kpi,
      question: a.question,
      metric: a.query.metrics[0] ?? '',
      baseline: base.value,
      value: now.value,
      deltaPct: deltaPct(base.value, now.value),
      failures,
      confidence: confidenceFor(failures),
      error: now.error,
      displaySql: now.displaySql,
      policies: now.policies,
    });
  }
  return out;
}

/** Single-layer deltas for every answer — what `declared_delta_pct` in knockout.yaml records. */
export async function singleLayerDeltas(pack: Pack, qs: QueryService, who: Principal): Promise<Record<string, Partial<Record<KnockoutLayer, number>>>> {
  const out: Record<string, Partial<Record<KnockoutLayer, number>>> = {};
  for (const a of pack.knockout.answers) {
    const base = await valueOf(qs, who, a, []);
    const row: Partial<Record<KnockoutLayer, number>> = {};
    for (const layer of LAYER_ORDER) {
      const v = await valueOf(qs, who, a, [layer]);
      const d = deltaPct(base.value, v.value);
      if (d !== null) row[layer] = d;
    }
    out[a.id] = row;
  }
  return out;
}
