import { describe, it } from 'vitest';

// CLAUDE.md §4.5 — Human-in-the-loop, structurally. Implemented in Phase 5.
describe('I05 human-in-the-loop', () => {
  it.todo('lifecycle agent output is persisted only as AgentProposal rows with field-level provenance');
  it.todo('a stage cannot be submitted for gate review while any field holds unreviewed agent output');
  it.todo('accepting a proposal records the accepting human on the new ArtifactVersion field provenance');
});
