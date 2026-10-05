# ADR-0008 — Agents never approve

- Status: Accepted (Phase 0; access requests Phase 4, gates/certification Phase 5)
- Source: `02-architecture.md` §2, CLAUDE.md §2 promise 1, inherited from ADPM

## Decision
Agents draft, profile, critique, answer and monitor. They never approve a gate, commit an artifact
version, grant access, certify or publish. `recordDecision()` is the only code path that sets a gate to
APPROVED, an access request to GRANTED, or a product/agent to CERTIFIED/PUBLISHED (invariant I04), and
it rejects agent actors at every autonomy level. Seeds call it too, with a seeded human actor. Agent
output is stored as `AgentProposal` rows with field-level provenance (invariant I05).

## Consequences
- No autonomy level, admin flag or demo mode changes this; tests assert it structurally.
