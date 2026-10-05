# 06 — Lifecycle, Certification & Governance Workflows

Port ADPM's engine (`src/lib/lifecycle/*`, `src/lib/artifacts/*`) with its tests first, then extend.

## 1. Stages, phases, artifacts, agents, gates

| # | Stage | Phase | Artifacts (registry keys) | Lifecycle agent | Gate: required roles (quorum) · veto |
|---|---|---|---|---|---|
| 1 | Consumption Discovery | Discover | decision-register | Discovery, Curator | DOMAIN_PRODUCT_OWNER (1) |
| 2 | Charter & Value Case | Discover | charter, value-case | Charter | DOMAIN_PRODUCT_OWNER, PORTFOLIO_LEAD (2) |
| 3 | Source Discovery & Profiling | Design | source-inventory, profile-report, gap-log | Profiling | DATA_ENGINEER, DATA_STEWARD (2) |
| 4 | Conceptual & Logical Model | Design | logical-model, er-diagram | Modelling | DATA_ARCHITECT (1) |
| 5 | Attribute Register & Data Contract | Design | attribute-register, data-contract | Definition | DATA_STEWARD, DOMAIN_PRODUCT_OWNER (2) |
| 6 | Semantic Model & Metrics | Build | semantic-model | Semantic | SEMANTIC_STEWARD (1) |
| 7 | Physical Architecture | Build | physical-architecture, lineage-diagram | Architecture | DATA_ARCHITECT, DATA_ENGINEER (2) |
| 8 | Quality & Observability | Build | quality-rules, runbook | Quality | DATA_STEWARD (1) |
| 9 | Access & Governance | Certify & Publish | access-policy, regulatory-map | Compliance | PRIVACY_SECURITY_OFFICER (1) · veto PRIVACY_SECURITY_OFFICER |
| 10 | Serving & Consumption | Certify & Publish | serving-spec, marketplace-listing, grounding-pack | Grounding | DOMAIN_PRODUCT_OWNER (1) |
| 11 | Certification & Publication | Certify & Publish | certification-scorecard | Evidence | GOVERNANCE_COUNCIL (2) · veto GOVERNANCE_COUNCIL |
| 12 | Operate, Evolve & Retire | Operate | telemetry, feedback-log, change-requests, benefit-realisation | Steward (L3 monitor) | — (continuous) |

Critic agent runs on any stage on request and comments on fields.

Persona→role mapping comes from `personas.yaml`; a single persona may hold multiple roles, so quorum
counts **distinct roles from distinct personas** (presenter switches persona to show quorum).

## 2. Engine rules (port + tests)

- `requestTransition(productId, toStage, actor)` — validates exit criteria for current stage, sets gate
  `IN_REVIEW`, snapshots evidence (artifact version ids + hashes).
- `recordDecision({subjectType, subjectId, personaId, role, outcome, rationale})` — the **only**
  approval path for gates, access requests, triage, agent publish and product certify. Evaluates quorum
  and veto via the pure `evaluateGateOutcome()`. Writes `Decision`, `AuditEvent`; on approval advances
  stage / grants entitlement / certifies.
- Exit criteria (ported list) + Keystone additions:
  - Stage 3: profiling executed on every source object (real results present).
  - Stage 6: semantic model compiles; every metric returns a value; each KPI linked to a term.
  - Stage 8: DQ rules executed; product quality score ≥ rubric minimum for target tier.
  - Stage 10: grounding pack references only GOLD/SEMANTIC layers (ADPM ADR 0009 rule kept).
  - Stage 11: all 8 certification checks `pass` (warn allowed only with a recorded waiver Decision).
  - All stages: "no unreviewed agent fields".
- Cascade: on new `ArtifactVersion`, find approved gates whose evidence includes the previous version
  of that artifact → set `STALE` with reason, create re-approval `Task`s, banner on product.
- Versioning: semver on publish; contract change classifier (ported from AI-Ready impact):
  breaking (column removed/renamed/type narrowed) → major + 30-day notice; additive → minor; doc → patch.

## 3. Certification checks (Stage 11 automated inputs)

| # | Check | Pass rule (thresholds in rubrics) | Fix action in UI |
|---|---|---|---|
| 1 | Ownership & purpose | owner, steward, purpose, decision present | Assign steward |
| 2 | Data contract | contract artifact approved; SLA set; schema matches warehouse | Regenerate from schema |
| 3 | Data quality | quality score ≥ 90 (warn 80–90, fail < 80) | Open DQ results |
| 4 | Semantic model | ≥ 10 verified queries; Cortex-Analyst-style eval ≥ 90% (eval = golden VQ execution match) | Add verified queries |
| 5 | Glossary alignment | every output column with a term mapping or explicit "no term" | Map terms |
| 6 | Governance | sensitive columns tagged **and** masked; row-access policy where pack requires; grants defined | Attach policy |
| 7 | Lineage & observability | lineage to Bronze complete; freshness monitor active | Generate lineage |
| 8 | Agent readiness | grounding pack approved; instructions, rules, synonyms present; bound agent eval ≥ 90% | Open Agent Quality |

Check results persist in `CertificationCheckResult`; the certification-scorecard artifact embeds them
plus DATSIS+V 0–5 scores (ported) with citations. The cert demo product's `certification_script`
drives the scripted warn/fail and fixes, but **fixes really change state** (overlay rows, policy
attachments in the warehouse) and checks are re-evaluated for real.

## 4. Autopilot (ported Run Console)

Modes: `automated` (run each stage's agent, auto-accept nothing, pause for review) and `manual`
(step-through). Speeds: instant / 1 s / 3 s per step (presenter). For a product at Stage N:
run agent → stream narrative → proposals appear → pause `AWAITING_REVIEW` → (presenter accepts all as
Persona C, with "accept all" disabled for sensitive fields) → submit → pause `AWAITING_GATE` → approve
as required persona(s) → next stage. Cancel anytime. Autopilot never calls `recordDecision`.

## 5. Agent autonomy (ported)

L0 Off · L1 Suggest (on request) · L2 Draft (runs on stage entry) · L3 Monitor (scheduled, read-only;
Steward agent watches freshness/DQ/usage and raises findings/tasks/change requests). Settings can only
be lowered below the agent's ceiling. Budget per workspace (USD) shown in Admin; exceeded → heuristic provider.

## 6. Access workflow

1. Request (purpose, justification, duration) → **policy preview** computed by
   `access/evaluate(product, persona, purpose)`: applicable policies from `policies.yaml`, auto-approve
   eligibility (e.g. aggregate-only products for internal purposes), required approver roles, columns
   that will remain masked, row filter that will apply.
2. Auto-approvable → `recordDecision` by SYSTEM actor with policy id as rationale (still audited).
3. Otherwise PENDING → inbox of approver personas → approve/deny with rationale.
4. GRANTED → `Entitlement` row; `GOVERNANCE.GRANTS` sync; agents see it immediately.
5. Expiry: `durationDays` from grant relative to demo clock; Admin can fast-forward demo clock.

## 7. Intake & triage (ported from ADPM)

Wizard → `ProductRequest` with duplicate candidates (TF-IDF over products' decisions/questions and
scenarios; threshold in rubric) → triage by Persona C: approve (creates product at Stage 1 with
decision-register pre-filled), merge (links to existing product, notifies requester), decline (reason
required). SLA from rubric (default 72 h) with breach indicator.

## 8. Audit & exports

- Every mutation emits `AuditEvent` (hash-chained). Agent outputs emit `AgentAction`.
- **Evidence pack (.docx)**: product summary, decision record, all approved artifacts (latest versions
  with hashes), gate decisions with personas and rationales, certification checks, DQ results, lineage
  diagram (rendered PNG), agent contributions with provenance, audit digest. Port `src/lib/exports/docx.ts`.
- **Data contract**: ODCS v3 YAML (port `standards/contracts.ts`), plus Snowflake semantic view YAML.
- **OpenLineage** JSON for the product's lineage.
- **Audit bundle (.zip)**: NDJSON events + manifest with chain verification result.
