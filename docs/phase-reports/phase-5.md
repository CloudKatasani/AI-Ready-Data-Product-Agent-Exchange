# Phase 5 — Lifecycle & certification

Status: **complete**. Date: 2026-10-06. Phase 6 follows on.

## Built

| Deliverable | Where |
|---|---|
| Prisma lifecycle models: StageRun, Gate (+ submittedAt), GateEvidence, Artifact, ArtifactVersion (content-hashed), FieldProvenance, Comment, Task, ChangeRequest, CertificationCheckResult, AppliedFix, AgentAction, AgentProposal, AutopilotRun, AgentSetting, ProductRequest. AuditEvent.prevHash is now unique so concurrent appends can't fork the chain | `prisma/schema.prisma`, 4 migrations |
| **12 stages and 5 phases** with each stage's artifacts, agent and gate (roles, quorum, veto). Spec roles are mapped onto pack roles (ADR-0017) | `src/lib/lifecycle/stages.ts` |
| **Artifact registry** (25 types, field schemas, sensitive flags) and a **blueprint generator** that drafts every artifact from pack content | `src/lib/lifecycle/artifacts/` |
| **Engine**: commit (append-only, sha256 of canonical JSON, per-field provenance) with **cascade-to-STALE** plus re-approval tasks; exit-criteria facts; submit-for-review with an evidence snapshot; certification evaluation; certification fixes | `src/lib/lifecycle/engine.ts`, `criteria.ts`, `gates.ts` |
| **`recordDecision()` extended to gates** (quorum of distinct personas covering every role, veto, stage advance, gate 11 → CERTIFIED + semver publish) and **triage** (creates the Draft product). It is still the only approval path | `src/lib/lifecycle/decisions.ts` |
| **Real profiling** (Stage 3) and the **DQ engine** (Stage 8) through QueryService. Quality uses row-level pass rates, with snapshots | `profiling.ts`, `quality.ts` |
| **Eight certification checks**, evaluated from live state. The cert demo product (DP-UTL-005) starts at check 4 warn (7 active verified queries) and check 6 fail (customer email exposed without masking). FIX-1 activates three verified queries and FIX-2 attaches masking; both change real state, and masking then applies in QueryService | `certification.ts`, `presenter/governed.ts` (`policyState`) |
| **Lifecycle-driven seed**: every pack product goes through the real engine to `seed_stage`. Criteria are checked for real and gates are approved by seeded personas via `recordDecision`. Status and version are engine outcomes, checked against the pack (8.5 s for utilities) | `src/lib/lifecycle/seed.ts`, `src/lib/presenter/seed.ts` |
| **Lifecycle agents**: a registry of 14, plus a deterministic heuristic provider (in `agents/`, boundary-clean). Agent runs persist AgentAction and OPEN AgentProposals. Accept, edit or reject commits with provenance "Agent — accepted by …". Accept-all skips sensitive fields | `src/lib/agents/lifecycle-agents/`, `src/lib/lifecycle/agent-runs.ts` |
| **Autopilot**: step machine that runs the agent, pauses for review, submits when criteria pass and pauses for the gate. It never accepts and never decides | `autopilot.ts` |
| **Intake & triage**: validated five-step input. Duplicate detection = max(text TF-IDF, mean of the two best question-to-scenario matches); REQ-UTL-001 → DP-UTL-002 at 0.84. Triage: approve (recordDecision → DP-UTL-1xx at Stage 1 + decision register), merge or decline. SLA from the rubric | `intake.ts`, `src/lib/packs/similarity.ts` |
| **Exports**: evidence pack (.docx via a hand-written OOXML + zip writer), audit bundle (.zip with NDJSON and a manifest carrying the chain verification result), OpenLineage run events; `GET /api/export` | `src/lib/exports/`, `src/lib/standards/openlineage.ts` |
| **Product Studio**: board (Kanban by phase) and table. Workspace: stage navigation with gate dots, stale banner, schema-driven artifact editors with provenance badges, agent panel (run / accept / edit / reject / accept-all), exit criteria, gate panel (roles, quorum meter, evidence, decisions, Submit / Approve / Reject / Veto by persona role), certification checklist with Fix actions, autopilot console (play/pause/speed), Stage 3/8 tools, exports | `src/app/[pack]/(builder)/studio`, `src/components/lifecycle/*` |
| **Request a Product** wizard with duplicate suggestions; request detail with triage (approve / merge / decline) | `src/app/[pack]/(consumer)/request` |
| Pack content: 23 more verified queries (VQ-UTL-055…077), so every certified view meets the rubric minimum of 10. BILLING_AR stays at 7, reaching 10 with FIX-1. Timeliness DQ rules DQ-UTL-049…051. Persona E sits on the governance council | `packs/utilities/*` |

## Definition of Done

| Check | Result |
|---|---|
| **AC5.1**: a request whose questions match an existing scenario surfaces that product as a duplicate with similarity ≥ the rubric threshold | ✅ integration (0.84 ≥ 0.55) and e2e (wizard shows DP-UTL-002) |
| **AC5.2**: approving triage creates a product in Product Studio at Stage 1 with its decision record | ✅ integration and e2e |
| **AC6.1**: no code path other than `recordDecision()` approves a gate | ✅ invariant I04 (source scans for gate writes, the evaluator's single caller, CERTIFIED/publish writes, Decision writes; autopilot and agents never call it) |
| **AC6.2**: submit is blocked while any agent proposal is unreviewed | ✅ integration, invariant I05 and e2e (submit disabled → accept all → submitted) |
| **AC6.3**: two certification fixes, then certify: Certified in Marketplace, and a previously declined answer now answers | ✅ integration (warn/fail → fixes → all pass → D + E quorum → CERTIFIED v1.0.0; masking live; A requests access, D approves, A's DSO answer is answered with a certified, version-1.0.0 citation and no provisional banner) and e2e (the full UI moment) |
| **AC6.4**: changing a contract column after Stage 5 approval makes the Stage 5 gate STALE | ✅ integration (stale reason + 2 re-approval tasks) and e2e |
| Invariants **I04, I05, I06** | ✅ I06: no update/delete on append-only models outside the seed reset; ArtifactVersion hashes verify; the audit chain verifies and detects tampering |
| Seed for utilities < 60 s | ✅ 8.5 s (scale M) |

Totals: `pnpm test` gives 27 files, 330 tests passing (12 `todo` for later phases). `pnpm test:e2e`: 142 passing, including Studio/intake flows and axe scans of the Studio and request screens. `pnpm pack:validate utilities`: 4,545 checks, 0 errors. Golden: 0 differences. Typecheck, lint and build are clean.

## Notes and decisions
- **AC6.3 reading**: "enables a previously-declined agent answer" is tested as the S2 story. After certification, persona A requests access, D approves, and A's previously declined DSO question answers from the now-certified product.
- **Governance check scope**: masking is checked on the columns a product exposes (its semantic view's expressions). The cert-demo gap on the shared customer dimension therefore fails DP-UTL-005 (which exposes `customer_email`) but not DP-UTL-001.
- **Tests now use the scale-M warehouse** for everything. At scale S, the monthly customer feed's freshness rule genuinely fails, so seeding can't certify the customer product there.
- **Lifecycle agents** live in `src/lib/agents/lifecycle-agents` (registry + provider, generic over field schemas). The orchestration that reads lifecycle state is in `src/lib/lifecycle/agent-runs.ts`, which keeps the module direction of 02 §3.
- **Local databases from before this phase** may hold a forked audit chain from parallel e2e runs. The new unique index would then fail to apply; recreate the dev DB with `pnpm db:setup` (Phase 9 replaces this with snapshot reset).
- DuckDB's parallel float aggregation can differ in the last bit between runs. Equality tests between surfaces compare at 1e-9; golden rounds to 6 significant digits.
