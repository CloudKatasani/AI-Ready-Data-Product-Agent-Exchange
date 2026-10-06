# ADR-0017 — Gate roles, quorum and the governance-council persona

Status: Accepted (Phase 5)

## Context
The gate table in 06 §1 names three roles that are not in the pack role vocabulary (`ROLES` in
`src/lib/packs/schema/common.ts`, used by every pack's personas): `DATA_ARCHITECT`, `SEMANTIC_STEWARD`
and `PRIVACY_SECURITY_OFFICER`. It also asks for a quorum of 2 at gate 11 (governance council), with
"distinct roles from distinct personas". The S2 story wants the presenter to switch persona to reach
that quorum, but in every pack only archetype D holds `GOVERNANCE_COUNCIL`.

## Decision
- Map the spec roles onto pack roles: `DATA_ARCHITECT → DATA_ENGINEER`, `SEMANTIC_STEWARD →
  DATA_STEWARD`, `PRIVACY_SECURITY_OFFICER → PRIVACY_OFFICER`. Gate 7 (`DATA_ARCHITECT, DATA_ENGINEER`)
  therefore needs one `DATA_ENGINEER`.
- Gate outcome (`evaluateGateOutcome`, pure):
  - Approved when the approving personas are distinct, number at least `quorum`, each holds a
    required role, and together cover every required role.
  - Any rejection by a persona holding a required role sends the gate back (REJECTED). A rejection by
    a veto role is recorded as `VETO`.
- Archetype E (executive) also sits on the governance council: utilities persona E gains
  `GOVERNANCE_COUNCIL`. Gate 11 is approved as D, then E. Other packs follow the same convention.

## Consequences
Every gate in every pack can be approved with the five demo personas, and quorum is visible on stage.
The mapping lives in one place (`src/lib/lifecycle/stages.ts`).
