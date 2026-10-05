import { describe, it } from 'vitest';

// CLAUDE.md §4.4 — One approval path. Access requests in Phase 4; gates, certification and publish in Phase 5.
describe('I04 one approval path', () => {
  it.todo('recordDecision() is the only code path that sets Gate.status = APPROVED (source scan + behaviour)');
  it.todo('recordDecision() is the only code path that sets AccessRequest.status = GRANTED');
  it.todo('recordDecision() is the only code path that sets DataProduct/Agent status to CERTIFIED or PUBLISHED');
  it.todo('recordDecision() rejects an agent actor at every autonomy level');
  it.todo('seeds reach approved states only via recordDecision() with a seeded human actor');
});
