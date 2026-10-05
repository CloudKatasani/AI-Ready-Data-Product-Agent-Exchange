import { describe, it } from 'vitest';

// CLAUDE.md §4.9 — Demo resettable. Implemented in Phase 9.
describe('I09 demo resettable', () => {
  it.todo('resetDemo() restores app DB and warehouse for the active profile to the snapshot state');
  it.todo('resetDemo() completes in under rubrics demo.reset_target_ms (3 s) using snapshot copy, not re-seed');
  it.todo('reset keeps the profile and its branding');
});
