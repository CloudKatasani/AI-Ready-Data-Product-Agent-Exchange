import { describe, expect, it } from 'vitest';
import { respondScripted } from '@/lib/agents/scripted/respond';
import { compileMetricQuery } from '@/lib/query/compiler';
import { pack, persona, rubrics, service } from '../setup/query';

/** 01 §5 performance budgets: scripted answers well inside `rubrics.demo.scripted_answer_budget_ms`. */
describe('performance budgets', () => {
  it('every scripted golden scenario answers within the budget (p95 and max)', async () => {
    const { qs } = await service();
    const times: number[] = [];
    for (const s of pack.scenarios) {
      await respondScripted(s.agent, s.question, { pack, rubrics, qs, who: persona('D') }); // warm
      const t = performance.now();
      await respondScripted(s.agent, s.question, { pack, rubrics, qs, who: persona('D') });
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
    expect(p95).toBeLessThan(rubrics.demo.scripted_answer_budget_ms);
    expect(times.at(-1) ?? 0).toBeLessThan(rubrics.demo.scripted_answer_budget_ms * 2);
  });

  it('metric compilation stays in the low milliseconds on average', () => {
    const qs = pack.scenarios.flatMap((s) => (s.query ? [s.query] : []));
    const t = performance.now();
    for (let i = 0; i < 20; i++) for (const q of qs) compileMetricQuery(q, pack, {});
    expect((performance.now() - t) / (20 * qs.length)).toBeLessThan(5);
  });
});
