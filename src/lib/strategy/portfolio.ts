/**
 * Portfolio prioritisation (01 §M11) — WSJF-with-reuse and RICE ported from ADPM `portfolio/scoring.ts`.
 * Scores are advisory: a named human can override any score with a recorded reason, because a scoring
 * model no human can override is a governance failure. Inputs are derived from what each product has
 * committed in the pack, so the score is not a separate opinion maintained by hand.
 */
import type { DataProduct, Pack, Rubrics } from '@/lib/packs/schema';

export interface ScoreInputs {
  /** 1–10: how much the blocked decision is worth unblocking. */
  value: number;
  /** 1–10: how much worse it gets by waiting. */
  urgency: number;
  /** 1–10: risk or compliance exposure removed. */
  riskReduction: number;
  /** 1–10: relative effort. Higher is more effort. */
  effort: number;
  /** 0–1: share of the conformed backbone and existing metrics reused. */
  reuse: number;
}

export interface ScoreResult {
  model: 'WSJF' | 'RICE';
  score: number;
  explanation: string;
}

/** WSJF adapted with a reuse multiplier: ((value + urgency + risk) ÷ effort) × (1 + reuse); rubric weights apply. */
export function wsjfWithReuse(i: ScoreInputs, w: Rubrics['prioritisation']['wsjf_weights'] = {}): ScoreResult {
  const effort = Math.max(i.effort, 1);
  const bv = w.business_value ?? 1;
  const tc = w.time_criticality ?? 1;
  const rr = w.risk_reduction ?? 1;
  const ru = w.reuse ?? 1;
  const base = (bv * i.value + tc * i.urgency + rr * i.riskReduction) / effort;
  const score = Number((base * (1 + ru * i.reuse)).toFixed(2));
  return { model: 'WSJF', score, explanation: `((${i.value} value + ${i.urgency} urgency + ${i.riskReduction} risk) ÷ ${effort} effort) × ${(1 + ru * i.reuse).toFixed(2)} reuse` };
}

/** RICE, offered as the alternative model. Reach is approximated by people affected. */
export function rice(i: { reach: number; impact: number; confidence: number; effort: number }): ScoreResult {
  const effort = Math.max(i.effort, 1);
  const score = Number(((i.reach * i.impact * i.confidence) / effort).toFixed(2));
  return { model: 'RICE', score, explanation: `(${i.reach} reach × ${i.impact} impact × ${i.confidence} confidence) ÷ ${effort} effort` };
}

/** ADPM `deriveInputs`, verbatim in behaviour. */
export function deriveInputs(p: { peopleAffected: number; cadence: string; sensitiveAttributes: number; buildEffortDays: number; backboneBindings: number; reusedMetrics: number; totalMetrics: number }): ScoreInputs {
  const cadenceWeight = /hour|daily|day/i.test(p.cadence) ? 9 : /week/i.test(p.cadence) ? 7 : /month/i.test(p.cadence) ? 5 : 3;
  return {
    value: Math.min(10, Math.max(1, Math.round(Math.log10(Math.max(p.peopleAffected, 1)) * 4 + 2))),
    urgency: cadenceWeight,
    riskReduction: Math.min(10, 2 + p.sensitiveAttributes),
    effort: Math.min(10, Math.max(1, Math.round(p.buildEffortDays / 10))),
    reuse: p.totalMetrics === 0 ? Math.min(1, p.backboneBindings * 0.2) : Math.min(1, p.backboneBindings * 0.2 + p.reusedMetrics / p.totalMetrics),
  };
}

/** Illustrative sizing constants for pack-derived inputs (documented on the Portfolio screen). */
export const PORTFOLIO_SIZING = { peoplePerConsumerGroup: 40, effortDaysPerUpstreamObject: 6 };

/** Pack-derived scoring inputs for one product. `sensitiveClasses` comes from the catalog (column tags). */
export function productInputs(pack: Pack, product: DataProduct, sensitiveClasses: number): ScoreInputs {
  const view = product.semantic_view ? pack.semantic.find((v) => v.name === product.semantic_view) : undefined;
  const metrics = product.kpis.map((k) => pack.kpis.find((x) => x.id === k)?.metric).filter((m): m is string => Boolean(m));
  const elsewhere = new Set(pack.products.filter((p) => p.id !== product.id).flatMap((p) => p.kpis.map((k) => pack.kpis.find((x) => x.id === k)?.metric)));
  return deriveInputs({
    peopleAffected: Math.max(1, product.consumers.length) * PORTFOLIO_SIZING.peoplePerConsumerGroup,
    cadence: product.decision.cadence,
    sensitiveAttributes: sensitiveClasses,
    buildEffortDays: product.upstream.length * PORTFOLIO_SIZING.effortDaysPerUpstreamObject,
    backboneBindings: view?.tables.filter((t) => t.fqn.includes('.DIM_')).length ?? 0,
    reusedMetrics: metrics.filter((m) => elsewhere.has(m)).length,
    totalMetrics: metrics.length,
  });
}

export function scoreProduct(model: 'WSJF' | 'RICE', rubrics: Rubrics, i: ScoreInputs, reach: number): ScoreResult {
  return model === 'RICE' ? rice({ reach, impact: Math.round((i.value + i.riskReduction) / 2), confidence: 0.8, effort: i.effort }) : wsjfWithReuse(i, rubrics.prioritisation.wsjf_weights);
}

export interface Ranked<T> {
  item: T;
  model: ScoreResult;
  final: number;
  override: { score: number; reason: string; by: string } | null;
  rank: number;
}

/** Ranks by the final score (a human override replaces the model score); ties break on id. */
export function rankWithOverrides<T extends { id: string }>(rows: { item: T; model: ScoreResult }[], overrides: Map<string, { score: number; reason: string; by: string }>): Ranked<T>[] {
  return rows
    .map((r) => {
      const o = overrides.get(r.item.id) ?? null;
      return { ...r, override: o, final: o ? o.score : r.model.score };
    })
    .sort((a, b) => b.final - a.final || a.item.id.localeCompare(b.item.id))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
