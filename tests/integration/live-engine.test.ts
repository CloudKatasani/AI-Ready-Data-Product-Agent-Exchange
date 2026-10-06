import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { getAdversarial } from '@/lib/packs/registry';
import type { LlmClient } from '@/lib/agents/live/client';
import { answerQuestion } from '@/lib/agents/runtime';
import { respondScripted } from '@/lib/agents/scripted/respond';
import { pack, persona, rubrics, service } from '../setup/query';

type Turn = (messages: Anthropic.MessageParam[]) => Anthropic.ContentBlock[];

function fake(turns: Turn[]): LlmClient & { calls: number } {
  const c = {
    calls: 0,
    async send(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
      const turn = turns[Math.min(c.calls, turns.length - 1)] as Turn;
      c.calls += 1;
      const content = turn(params.messages);
      return { id: `m${c.calls}`, type: 'message', role: 'assistant', model: 'fake', content, stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn', stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 150 } } as unknown as Anthropic.Message;
    },
  };
  return c;
}

const use = (name: string, input: unknown, id = `tu_${name}`): Anthropic.ContentBlock => ({ type: 'tool_use', id, name, input }) as unknown as Anthropic.ContentBlock;

/** Reads the latest tool_result payload (inside <tool_data>) from the conversation. */
function lastResult(messages: Anthropic.MessageParam[]): { result_id: string; columns: string[]; rows: (string | number)[][] } {
  const m = [...messages].reverse().find((x) => x.role === 'user' && Array.isArray(x.content));
  const block = (m?.content as Anthropic.ToolResultBlockParam[]).find((b) => b.type === 'tool_result');
  return JSON.parse(String(block?.content).replace(/^<tool_data>|<\/tool_data>$/g, ''));
}

const SAIDI_QUERY = { view: 'RELIABILITY', metrics: ['saidi'], dimensions: ['region'], timeRange: { last: { n: 1, unit: 'quarter' } }, orderBy: [{ field: 'saidi', dir: 'desc' }] };

const groundedAgent = (): Turn[] => [
  () => [use('semantic_query', SAIDI_QUERY)],
  (msgs) => {
    const r = lastResult(msgs);
    const [region, value] = r.rows[0] as [string, number];
    return [use('submit_answer', { kind: 'answer', headline: `${region} had the highest SAIDI last quarter at ${value.toFixed(1)} minutes.`, narrative: 'Major event days are excluded (BR-UTL-012).', chart: { type: 'bar', result_id: r.result_id, x: 'region', y: 'saidi' }, citations: [{ result_id: r.result_id, metric: 'saidi', rule_id: 'BR-UTL-012' }] })];
  },
];

const deps = async (client: LlmClient | null, archetype: 'A' | 'B' | 'D' = 'D') => {
  const { qs } = await service();
  return { pack, rubrics, qs, who: persona(archetype), live: { client, model: 'test-model', timeoutMs: 2000, maxRounds: 4 } };
};

describe('live engine (08 §4) with a scripted LLM client', () => {
  it('AC4.2 a golden question in live mode returns the same headline numbers as the scripted golden answer', async () => {
    const q = 'What was SAIDI by region last quarter?';
    const live = await answerQuestion('AG-UTL-002', q, 'live', await deps(fake(groundedAgent())));
    const scripted = await respondScripted('AG-UTL-002', q, await deps(null));
    expect(live.mode).toBe('live');
    expect(live.kind).toBe('answer');
    expect(live.result?.rows).toEqual(scripted.result?.rows);
    const n = (s: string) => s.match(/\d+\.\d/)?.[0];
    expect(n(live.headline)).toBe(n(scripted.headline));
    expect(live.citations.some((c) => c.kind === 'product')).toBe(true);
    expect(live.toolCalls?.map((t) => t.name)).toEqual(['semantic_query', 'submit_answer']);
    expect(live.costUsd).toBeGreaterThan(0);
  });

  it('rejects an invented number, allows one repair, and accepts the repaired answer', async () => {
    const turns: Turn[] = [groundedAgent()[0] as Turn, (m) => [use('submit_answer', { kind: 'answer', headline: 'East was at 99.9 minutes.', narrative: '', citations: [{ result_id: lastResult(m).result_id }] })], (m) => (groundedAgent()[1] as Turn)([...m.slice(0, -2), ...m.slice(-2)])];
    const c = fake([turns[0] as Turn, turns[1] as Turn, (msgs) => {
      const firstResultMsg = msgs.find((x) => x.role === 'user' && Array.isArray(x.content) && (x.content as Anthropic.ToolResultBlockParam[]).some((b) => String(b.content).includes('result_id')));
      return (groundedAgent()[1] as Turn)([firstResultMsg as Anthropic.MessageParam]);
    }]);
    const a = await answerQuestion('AG-UTL-002', 'What was SAIDI by region last quarter?', 'live', await deps(c));
    expect(a.mode).toBe('live');
    expect(a.toolCalls?.filter((t) => t.name === 'submit_answer').map((t) => t.ok)).toEqual([false, true]);
  });

  it('falls back to the scripted answer (badge + reason) after a second grounding failure — never an error', async () => {
    const bad: Turn = () => [use('submit_answer', { kind: 'answer', headline: 'SAIDI was 777.7 minutes.', narrative: '', citations: [{ result_id: 'R1' }] })];
    const c = fake([groundedAgent()[0] as Turn, bad, bad]);
    const a = await answerQuestion('AG-UTL-002', 'What was SAIDI by region last quarter?', 'auto', await deps(c));
    expect(a.mode).toBe('live_fallback');
    expect(a.fallbackReason).toMatch(/grounding/);
    expect(a.scenarioId).toBe('SC-UTL-001');
    expect(a.banners[0]?.kind).toBe('fallback');
  });

  it('falls back on timeout and when no key is configured', async () => {
    const hang: LlmClient = { send: (_p, signal) => new Promise((_r, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) };
    const d = await deps(hang);
    const t = await answerQuestion('AG-UTL-002', 'What was SAIDI by region last quarter?', 'live', { ...d, live: { ...d.live, timeoutMs: 50 } });
    expect(t.mode).toBe('live_fallback');
    expect(t.fallbackReason).toMatch(/too long/);
    const n = await answerQuestion('AG-UTL-002', 'What was SAIDI by region last quarter?', 'auto', await deps(null));
    expect(n.fallbackReason).toMatch(/API key/);
  });

  it('a live query is still governed: persona A gets row-filtered results; an unbound view is refused', async () => {
    const c = fake(groundedAgent());
    const a = await answerQuestion('AG-UTL-002', 'What was SAIDI by region last quarter?', 'live', await deps(c, 'A'));
    expect(a.result?.rowFiltered).toBe(true);
    const wrongView = fake([() => [use('semantic_query', { view: 'BILLING_AR', metrics: ['dso_days'] })], () => [use('submit_answer', { kind: 'decline', headline: 'I cannot answer that.', narrative: '', citations: [] })]]);
    const b = await answerQuestion('AG-UTL-002', 'What is DSO?', 'live', await deps(wrongView));
    expect(b.toolCalls?.[0]).toMatchObject({ name: 'semantic_query', ok: false });
  });

  it.each(getAdversarial().map((p) => [p.id, p.prompt] as const))('AC4.4 %s is declined before any model call (no tool misuse)', async (_id, prompt) => {
    const c = fake(groundedAgent());
    const a = await answerQuestion('AG-UTL-002', prompt, 'live', await deps(c));
    expect(a.kind).toBe('decline');
    expect(c.calls).toBe(0);
  });
});
