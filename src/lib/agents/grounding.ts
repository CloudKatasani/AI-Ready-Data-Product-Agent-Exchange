/**
 * Grounding validator (08 §4.4, invariant I07): every number an LLM answer states must come from a tool
 * result it cites — exactly, after the metric's rounding, or as a simple derived value (difference,
 * ratio, percent change of two cited values) within the rubric tolerance. Citations must resolve, and no
 * masked sensitive value may appear in the text. Pure: the live engine supplies the conversation state.
 */
export interface GroundingNumber {
  raw: string;
  value: number;
  decimals: number;
  percent: boolean;
}

/** Numbers stated in text, ignoring years, small bare integers, ordinals and identifier digits (F-2207, Q3, DP-ABC-001). */
export function extractNumbers(text: string): GroundingNumber[] {
  const out: GroundingNumber[] = [];
  const re = /(?<![A-Za-z0-9_.\-/])([-−+]?)\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%|\s?(?:k|K|M|bn)\b)?(?![A-Za-z0-9-])/g;
  for (const m of text.matchAll(re)) {
    const intPart = (m[2] ?? '').replace(/,/g, '');
    const frac = m[3] ?? '';
    const suffix = (m[4] ?? '').trim();
    let value = Number(`${intPart}${frac}`);
    if (!Number.isFinite(value)) continue;
    if (m[1] === '-' || m[1] === '−') value = -value;
    const percent = suffix === '%';
    if (suffix === 'k' || suffix === 'K') value *= 1e3;
    if (suffix === 'M') value *= 1e6;
    if (suffix === 'bn') value *= 1e9;
    const isInt = !frac && !percent && !suffix;
    if (isInt && Math.abs(value) < 10) continue;
    if (isInt && value >= 1900 && value <= 2100 && !m[0].includes(',')) continue;
    out.push({ raw: m[0], value, decimals: frac ? frac.length - 1 : 0, percent });
  }
  return out;
}

export interface GroundingContext {
  /** result_id → numeric cells of that governed result. */
  results: Map<string, number[]>;
  docIds: Set<string>;
  metrics: Set<string>;
  rules: Set<string>;
  /** Sensitive values the persona may not see; none may appear in the answer. */
  maskedValues: string[];
  /** Products used by results that the persona is not entitled to (should be empty). */
  unentitledProducts: string[];
  tolerance: number;
}

export interface AnswerCitation {
  claim?: string;
  result_id?: string;
  doc_id?: string;
  metric?: string;
  rule_id?: string;
}

export interface GroundingResult {
  ok: boolean;
  violations: string[];
  numbers: number;
}

function matches(n: GroundingNumber, values: number[], tol: number): boolean {
  const close = (v: number, target: number) => {
    const step = 0.5 * 10 ** -n.decimals;
    return Math.abs(v - target) <= Math.max(step + 1e-9, Math.abs(v) * tol);
  };
  const candidates = (v: number) => [v, Math.abs(v), v * 100, Math.abs(v * 100)];
  if (values.some((v) => candidates(v).some((c) => close(c, n.value)) || close(Math.round(v * 10 ** n.decimals) / 10 ** n.decimals, n.value))) return true;
  // Derived values from two cited numbers: difference, ratio, percent change.
  const limit = Math.min(values.length, 400);
  for (let i = 0; i < limit; i++) {
    for (let j = 0; j < limit; j++) {
      if (i === j) continue;
      const a = values[i] as number;
      const b = values[j] as number;
      const derived = [a - b, b !== 0 ? a / b : NaN, b !== 0 ? ((a - b) / b) * 100 : NaN];
      if (derived.some((d) => Number.isFinite(d) && candidates(d).some((c) => close(c, n.value)))) return true;
    }
  }
  return false;
}

export function validateGrounding(answer: { kind: string; headline: string; narrative: string; citations: AnswerCitation[] }, ctx: GroundingContext): GroundingResult {
  const violations: string[] = [];
  for (const c of answer.citations) {
    if (c.result_id && !ctx.results.has(c.result_id)) violations.push(`Citation refers to unknown result ${c.result_id}.`);
    if (c.doc_id && !ctx.docIds.has(c.doc_id)) violations.push(`Citation refers to a document not retrieved in this conversation: ${c.doc_id}.`);
    if (c.metric && !ctx.metrics.has(c.metric)) violations.push(`Unknown metric ${c.metric}.`);
    if (c.rule_id && !ctx.rules.has(c.rule_id)) violations.push(`Unknown business rule ${c.rule_id}.`);
  }
  const text = `${answer.headline}\n${answer.narrative}`;
  const numbers = extractNumbers(text);
  const cited = answer.citations.flatMap((c) => (c.result_id ? (ctx.results.get(c.result_id) ?? []) : []));
  if (answer.kind === 'answer' && numbers.length > 0 && cited.length === 0) violations.push('The answer states numbers but cites no query result.');
  for (const n of numbers) if (cited.length && !matches(n, cited, ctx.tolerance)) violations.push(`"${n.raw}" does not appear in any cited result (or a simple derivation of two cited values).`);
  for (const v of ctx.maskedValues) if (v.length >= 4 && text.includes(v)) violations.push('The answer contains a masked value.');
  for (const p of ctx.unentitledProducts) violations.push(`Result from ${p}, which this persona is not entitled to.`);
  return { ok: violations.length === 0, violations, numbers: numbers.length };
}
