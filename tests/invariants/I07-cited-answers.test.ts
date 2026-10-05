import { describe, it } from 'vitest';

// CLAUDE.md §4.7 — Cited answers. Scripted in Phase 3; live grounding in Phase 6.
describe('I07 cited answers', () => {
  it.todo('every AgentAnswer of kind "answer" carries at least one citation per numeric claim (scripted, all golden scenarios)');
  it.todo('the grounding validator rejects a live answer containing a number absent from tool results (tolerance rules in 08 §4.4)');
  it.todo('a grounding failure after one repair turn falls back to scripted with fallbackReason');
});
