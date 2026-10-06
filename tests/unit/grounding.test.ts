import { describe, expect, it } from 'vitest';
import { extractNumbers, validateGrounding } from '@/lib/agents/grounding';

const ctx = (values: number[]) => ({ results: new Map([['r1', values]]), docIds: new Set(['DOC-ABC-1']), metrics: new Set(['saidi']), rules: new Set(['BR-ABC-1']), maskedValues: ['jane@examplemail.com'], unentitledProducts: [], tolerance: 0.005 });

describe('extractNumbers', () => {
  it('ignores years, ids, small integers; reads percents, currency, decimals', () => {
    expect(extractNumbers('In 2026 feeder F-2207 (rank 3) had 58.8 minutes; spend $1,234,567 and 85.2% share in Q3.').map((n) => n.value)).toEqual([58.8, 1234567, 85.2]);
  });
});

describe('validateGrounding (I07 live)', () => {
  it('accepts numbers present after rounding, as percent of a fraction, or derived', () => {
    const r = validateGrounding({ kind: 'answer', headline: 'East is 58.8 minutes, 85.2% of target, up 21.8 from West.', narrative: '', citations: [{ result_id: 'r1' }] }, ctx([58.7807, 0.852, 36.98]));
    expect(r.violations).toEqual([]);
  });
  it('rejects an invented number', () => {
    const r = validateGrounding({ kind: 'answer', headline: 'SAIDI was 61.4 minutes.', narrative: '', citations: [{ result_id: 'r1' }] }, ctx([58.7807]));
    expect(r.ok).toBe(false);
  });
  it('rejects uncited numbers, unknown citations and masked leakage', () => {
    expect(validateGrounding({ kind: 'answer', headline: 'It was 58.8.', narrative: '', citations: [] }, ctx([58.8])).ok).toBe(false);
    expect(validateGrounding({ kind: 'answer', headline: 'ok', narrative: '', citations: [{ result_id: 'r9' }] }, ctx([1])).ok).toBe(false);
    expect(validateGrounding({ kind: 'decline', headline: 'Email jane@examplemail.com', narrative: '', citations: [] }, ctx([])).ok).toBe(false);
  });
});
