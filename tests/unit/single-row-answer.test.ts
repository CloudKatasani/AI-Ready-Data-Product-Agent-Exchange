import { describe, expect, it } from 'vitest';
import { periodPhrase, singleRowTemplates } from '@/lib/agents/scripted/template';

/** A comparative answer over a single visible row (row access) is restated plainly. */
describe('single-row answers', () => {
  const o = { slice: 'region', metric: 'saidi', label: 'SAIDI', unit: ' minutes', period: 'last quarter' };

  it('replaces comparative wording and drops cross-row sentences, keeping rule sentences', () => {
    const r = singleRowTemplates('{{top.region}} had the highest SAIDI last quarter at {{top.saidi}} minutes.', 'Major event days are excluded (BR-1). {{bottom.region}} was lowest at {{bottom.saidi}} minutes across {{rows}} regions.', o);
    expect(r).toEqual({ headline: '{{top.region}} · SAIDI last quarter: {{top.saidi}} minutes.', narrative: 'Major event days are excluded (BR-1).' });
  });

  it('leaves non-comparative templates alone', () => {
    expect(singleRowTemplates('SAIDI is {{top.saidi}} minutes.', 'Defined per IEEE 1366.', o)).toBeNull();
  });

  it('names the period', () => {
    expect(periodPhrase({ last: { n: 1, unit: 'quarter' } })).toBe('last quarter');
    expect(periodPhrase({ last: { n: 3, unit: 'month' } })).toBe('in the last 3 months');
    expect(periodPhrase({ ytd: true })).toBe('this year');
    expect(periodPhrase(undefined)).toBe('');
  });
});
