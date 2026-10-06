import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { liveOrHeuristicPropose } from '@/lib/agents/lifecycle-agents/live';

const base = { agentName: 'Charter', charter: 'Drafts the charter.', artifactLabel: 'charter', fields: [{ path: 'purpose', label: 'Purpose', kind: 'longtext' }, { path: 'owner', label: 'Owner', kind: 'text' }], current: {}, evidence: { purpose: 'Give ops one view', owner: 'Grid DPO' }, evidenceSources: ['pack'], allowSampleData: false };
const reply = (input: unknown) => ({ send: async () => ({ content: [{ type: 'tool_use', id: 't', name: 'propose', input }], usage: { input_tokens: 10, output_tokens: 5 } }) as unknown as Anthropic.Message });

describe('lifecycle agents — live provider with heuristic fallback (08 §7)', () => {
  it('uses the propose tool output, keeping only known fields', async () => {
    const r = await liveOrHeuristicPropose(base, { client: reply({ narrative: 'Drafted.', proposals: [{ fieldPath: 'purpose', value: 'X', rationale: 'r' }, { fieldPath: 'bogus', value: 1, rationale: 'r' }] }), model: 'm', timeoutMs: 1000 });
    expect(r.provider).toBe('anthropic');
    expect(r.proposals.map((p) => p.fieldPath)).toEqual(['purpose']);
  });
  it('falls back to the deterministic heuristic on malformed output or no client', async () => {
    expect((await liveOrHeuristicPropose(base, { client: reply({ nope: true }), model: 'm', timeoutMs: 1000 })).provider).toBe('heuristic');
    const h = await liveOrHeuristicPropose(base, null);
    expect(h.provider).toBe('heuristic');
    expect(h.proposals.map((p) => p.fieldPath)).toEqual(['purpose', 'owner']);
  });
});
