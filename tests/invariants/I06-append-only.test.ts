import { describe, it } from 'vitest';

// CLAUDE.md §4.6 — Append-only history. Implemented in Phase 5.
describe('I06 append-only history', () => {
  it.todo('AuditEvent, AgentAction, ArtifactVersion, QueryLog and AnswerRecord expose no update or delete path');
  it.todo('ArtifactVersion rows are content-hashed and the hash verifies');
  it.todo('the audit hash chain detects a tampered row');
  it.todo('nothing in the app hard-deletes a row (soft archive only)');
});
