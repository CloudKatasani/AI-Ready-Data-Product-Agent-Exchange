import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { validateGrounding } from '@/lib/agents/grounding';
import type { LlmClient } from '@/lib/agents/live/client';
import { answerQuestion } from '@/lib/agents/runtime';
import { respondScripted } from '@/lib/agents/scripted/respond';
import { pack, persona, rubrics, service } from '../setup/query';

const NUMBER = /\d[\d,]*(\.\d+)?/g;

// CLAUDE.md §4.7 — Cited answers. Scripted in Phase 3; live grounding in Phase 6.
describe('I07 cited answers', () => {
  it.each(pack.scenarios.filter((s) => s.kind === 'answer').map((s) => [s.id, s] as const))('%s: a scripted answer cites product, metric and SQL for its numbers', async (_id, s) => {
    const { qs } = await service();
    for (const arch of ['B', 'D'] as const) {
      const a = await respondScripted(s.agent, s.question, { pack, rubrics, qs, who: persona(arch) });
      if (a.kind !== 'answer') continue;
      const numbers = `${a.headline} ${a.narrative}`.match(NUMBER) ?? [];
      if (numbers.length === 0) continue;
      const kinds = new Set(a.citations.map((c) => c.kind));
      expect(kinds.has('product'), 'product@version citation').toBe(true);
      expect(kinds.has('metric'), 'metric definition citation').toBe(true);
      expect(kinds.has('sql'), 'governed SQL citation').toBe(true);
      expect(a.citations.length).toBeGreaterThanOrEqual(3);
      // Every product citation names a version, and the SQL citation points at the QueryLog row.
      for (const c of a.citations.filter((x) => x.kind === 'product')) expect(c.ref).toMatch(/^DP-[A-Z]+-\d{3}@\d+\.\d+\.\d+(-[\w.]+)?$/);
      expect(a.citations.find((c) => c.kind === 'sql')?.ref).toBe(a.result?.queryLogId);
    }
  });

  it('every number in a scripted headline is present in the governed result (rounded)', async () => {
    const { qs } = await service();
    for (const s of pack.scenarios.filter((x) => x.kind === 'answer')) {
      const a = await respondScripted(s.agent, s.question, { pack, rubrics, qs, who: persona('D') });
      if (!a.result) continue;
      const cells = a.result.rows.flat().filter((v): v is number => typeof v === 'number');
      const total = cells.reduce((x, y) => x + y, 0);
      for (const raw of a.headline.replace(/[A-Z]+-\d+/g, '').match(NUMBER) ?? []) {
        const n = Number(raw.replace(/,/g, ''));
        if (Number.isInteger(n) && (n < 10 || (n >= 1900 && n <= 2100))) continue; // years, ordinals, small counts (grounding ignore rules)
        const close = (c: number) => Math.abs(c - n) <= Math.max(0.051, Math.abs(c) * rubrics.grounding.derived_value_tolerance_rel);
        // Derived values allowed by 08 §4.4: totals and differences between two cells.
        const derived = cells.some((x) => cells.some((y) => close(Math.abs(x - y))));
        const found = cells.some(close) || derived || Math.abs(total - n) <= Math.abs(total) * 0.01 || a.result.rows.length < 2;
        expect(found, `${s.id}: ${raw} not in result`).toBe(true);
      }
    }
  });

  it('the grounding validator rejects a live answer containing a number absent from tool results (tolerance rules in 08 §4.4)', () => {
    const ctx = { results: new Map([['R1', [41.2, 37.5]]]), docIds: new Set<string>(), metrics: new Set(['saidi']), rules: new Set<string>(), maskedValues: [], unentitledProducts: [], tolerance: rubrics.grounding.derived_value_tolerance_rel };
    const answer = (headline: string) => ({ kind: 'answer', headline, narrative: '', citations: [{ result_id: 'R1', metric: 'saidi' }] });
    expect(validateGrounding(answer('East leads at 41.2 minutes, 3.7 more than West.'), ctx).ok).toBe(true);
    const bad = validateGrounding(answer('East leads at 52.9 minutes.'), ctx);
    expect(bad.ok).toBe(false);
    expect(bad.violations.join(' ')).toMatch(/52\.9/);
  });

  it('a grounding failure after one repair turn falls back to scripted with fallbackReason', async () => {
    const { qs } = await service();
    const s = pack.scenarios.find((x) => x.id === pack.manifest.story_roles.heroScenario) ?? pack.scenarios[0];
    let calls = 0;
    const client: LlmClient = {
      async send() {
        calls += 1;
        const content = [{ type: 'tool_use', id: `t${calls}`, name: 'submit_answer', input: { kind: 'answer', headline: 'The value is 987.6 minutes.', narrative: '', chart: { type: 'none' }, citations: [{ metric: 'saidi' }] } }];
        return { id: `m${calls}`, type: 'message', role: 'assistant', model: 'fake', content, stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } } as unknown as Anthropic.Message;
      },
    };
    const a = await answerQuestion(s?.agent ?? '', s?.question ?? '', 'auto', { pack, rubrics, qs, who: persona('D'), live: { client, model: 'test-model', timeoutMs: 2000, maxRounds: 4 } });
    expect(a.mode).toBe('live_fallback');
    expect(a.fallbackReason).toBeTruthy();
    expect(a.headline).not.toContain('987.6');
    expect(calls).toBe(2);
  });
});
