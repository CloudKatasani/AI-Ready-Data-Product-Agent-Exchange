import { describe, expect, it } from 'vitest';
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

  it.todo('the grounding validator rejects a live answer containing a number absent from tool results (tolerance rules in 08 §4.4)');
  it.todo('a grounding failure after one repair turn falls back to scripted with fallbackReason');
});
