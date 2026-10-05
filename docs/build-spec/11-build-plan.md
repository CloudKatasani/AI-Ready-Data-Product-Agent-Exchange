# 11 — Build Plan (phase by phase for Claude Code)

Each phase ends with: run DoD checks → phase report → **stop and wait for confirmation**.
Effort is indicative Claude-Code sessions for one developer supervising. MVP = Phases 0–7 + 9
(utilities + banking + healthcare + retail deep, all six stories). Phases 8, 10, 11 complete the vision.

| Phase | Name | Outcome | Sessions |
|---|---|---|---|
| 0 | Scaffold & contract | Repo, tooling, CI, shell, invariant test stubs | 1 |
| 1 | Packs & warehouse | Pack schema/loader/validator, generator, DuckDB build, utilities pack converted | 3 |
| 2 | Governed query & knowledge screens | Compiler, policy engine, QueryService, Explorer, Semantic, Glossary, Context, persona switcher | 3 |
| 3 | Scripted agents & Ask | Matcher, planner, guardrails, trace, Ask screen, Home | 2 |
| 4 | Marketplace & access | Catalog, search, product/agent detail, access workflow, demand, mesh, My Access | 2–3 |
| 5 | Lifecycle & certification | Ported engine, Studio, artifacts, lifecycle agents (heuristic), cert checks, autopilot, intake/triage, exports | 3–4 |
| 6 | Live LLM + three more deep packs | Live engine, grounding, eval harness, publish gate, Agent Factory; banking, healthcare, retail packs | 3–4 |
| 7 | Run (operate) | Health/incidents, Agent Quality loop, Cost & Value, Impact, Audit | 2 |
| 8 | Strategy | Platform Map, Knockout, Compare, Readiness, Roadmap, Coverage, Portfolio, Operating Model, Build Guide | 2–3 |
| 9 | Presenter & stories | Launcher, profiles, branding, snapshots/reset, story rail, tour/spotlight, 6 stories × 4 packs green | 2 |
| 10 | Industry expansion | insurance, telecom, manufacturing, public-sector (deep); technology, transportation, _generic (standard); Pack Drafter | 3–4 |
| 11 | Hardening & packaging | Perf, a11y, security tests, Docker, doctor, profile-scoping for shared server, optional Snowflake adapter | 2–3 |

---

## Phase 0 — Scaffold & contract
- Next.js 15 + TS strict + Tailwind 4 + shadcn init; pnpm; ESLint (boundaries, custom rules stubs); Vitest; Playwright; Prisma with SQLite.
- AppShell with door nav, top bar, empty route stubs for every route in `01` §3, `copy/en.ts`.
- `tests/invariants/I01…I11` created as failing/`todo` placeholders listing what each will assert.
- CI workflow (steps 1–3, 7). `.env.example`. ADR-0001…0008 written from `02` §2.
- **DoD**: `pnpm dev` shows shell; `pnpm test` runs; CI green; ADRs present.

## Phase 1 — Packs & warehouse
- `src/lib/packs/schema.ts` (Zod for every file in `04` §2–3) + JSON Schema emit; loader with caching; registry.
- Generator primitives (`04` §5), RNG port, CDC noise, planted patterns; DuckDB adapter (`WarehouseAdapter`); Silver/Gold SQL runner; SEMANTIC/GLOSSARY/CONTEXT/GOVERNANCE generated objects; masking macros.
- **Convert the utilities pack** from the three sources (`04` §8): target full Deep quotas.
- `pnpm warehouse:build --pack utilities --scale M`, `pnpm pack:validate` (categories 1–6, 9, 10 now; 7–8 after Phases 2–3).
- Invariants I01 (domain-string lint), I08 (determinism) implemented.
- **DoD**: validator green for utilities; two builds produce identical checksums; build ≤ 25 s.

## Phase 2 — Governed query & knowledge screens
- Compiler (`05` §1, without knockout), policy engine (`05` §2, incidents stubbed), sql-safety, display SQL translator, QueryService + QueryLog.
- Prisma models: Persona, QueryLog, Entitlement, AuditEvent, KnowledgeOverlay. Seed personas + entitlements from pack.
- Persona switcher (signed cookie). Explorer (tree, preview, columns, DDL, lineage graph, quality placeholder, governance, worksheet). Semantic (views, model diagram, metrics, VQ, YAML, Playground). Glossary. Context (incl. document search).
- Invariants I02 (no direct DuckDB import), I03 (one compiler), I11 (no secret leakage) implemented.
- **DoD**: AC8.1, AC8.2, AC9.1 green; validator categories 4–6 fully green.

## Phase 3 — Scripted agents & Ask
- Scripted engine (`08` §3) with ported matcher/respond/trace + TS planner port; guardrails; templates.
- AnswerRecord, AnswerFeedback models; `/api/ask` SSE; Ask screen with inspector tabs; Home (hero via cross-agent matcher, KPI tiles, Answer Theatre, counters, ticker stub).
- `pnpm golden` + golden tests; validator categories 7–8.
- **DoD**: AC2.1, AC2.2, AC4.1, AC4.3 green; all utilities scenarios match golden; invariant I07 (citations) for scripted.

## Phase 4 — Marketplace & access
- DataProduct/Agent records seeded from pack (status only; lifecycle history comes in Phase 5 — seed marks it TODO-free by using a temporary `seedStatus` path that Phase 5 replaces).
- Catalog + MiniSearch + facets; cards; compare; product detail tabs; agent detail tabs (evaluation tab reads EvalRun when present).
- Access request with policy preview; `recordDecision()` introduced here (gates come in Phase 5) — invariant I04 implemented for ACCESS_REQUEST.
- Demand board; mesh (data + agent) with blast radius; My Access with coverage matrix; inbox for approvers.
- **DoD**: AC3.1–3.3 green.

## Phase 5 — Lifecycle & certification
- Port ADPM stages/criteria/transitions/cascade/artifact registry/commit/diff **with their tests**.
- Blueprint generator → seed drives every pack product through the real engine to `seed_stage` (replace Phase 4 shortcut).
- Studio list + workspace, artifact editors (schema-driven), provenance, comments, gate panel, exit criteria.
- Real profiling (Stage 3) and DQ engine (Stage 8) via QueryService; QualityScoreSnapshot.
- Lifecycle agents with ported heuristic provider; AgentAction/AgentProposal; Autopilot.
- Certification checks + cert demo script + publish v1.0.0; intake wizard + triage; exports (evidence pack, ODCS, OpenLineage, audit bundle).
- Invariants I04 (gates), I05 (unreviewed fields), I06 (append-only) implemented.
- **DoD**: AC5.1, AC5.2, AC6.1–6.4 green; seed for utilities completes < 60 s.

## Phase 6 — Live LLM, Agent Factory, three more deep packs
- Live engine (`08` §4): prompt, tools, streaming, `submit_answer`, grounding validator, fallback, budgets, mode badge; Router.
- Lifecycle agents live provider (`propose` tool). Agent Designer.
- Eval harness (all suites) + publish gate + release/canary/rollback; Agent Factory UI (7 steps).
- Convert **banking, healthcare, retail** packs (Deep) via `04` §8; golden + eval green for each.
- **DoD**: AC4.2, AC4.4, AC7.1, AC7.2 green; live eval report for utilities attached (if key available).

## Phase 7 — Run (operate)
- Incidents with overlay views + effects into answers/confidence; Health board; blast radius; postmortems.
- Agent Quality: scorecards over time, feedback inbox, Quality Fixer, overlays, re-eval delta.
- Cost & Value (port `ext/cost.ts` + marketplace value model/finops); Impact (port `ext/impact.ts`); Audit stream + hash chain verification.
- **DoD**: AC10.1, AC10.2 green on all four deep packs.

## Phase 8 — Strategy
- Port readiness, roadmap, coverage, knockout, raci, buildGuide engines verbatim with their tests; wire to QueryService/lifecycle.
- Platform Map with flow replay; Knockout (compiler knockout rewrites `05` §1.7); Compare; Readiness + Advisor; Roadmap Gantt; Portfolio (WSJF/RICE + override, maturity); Operating Model; Build Guide.
- **DoD**: AC11.1, AC11.2 green; knockout deltas match pack declarations for all deep packs.

## Phase 9 — Presenter & stories
- Launcher, DemoProfile, branding tokens + contrast guard, terminology overrides, snapshot/reset, checkpoints.
- Story engine + rail + cue cards + spotlight/tour (port ADPM tour) + presenter menu + shortcuts + leave-behind mode + story PDF export.
- Add `profileId` scoping to runtime models (needed for shared server).
- **DoD**: AC1.1–1.5; all 6 stories green on 4 deep packs; reset < 3 s.

## Phase 10 — Industry expansion
- Convert insurance, telecom, manufacturing, public-sector (Deep); build technology, transportation, _generic (Standard).
- Pack Drafter (M13) with validator-in-the-loop and Draft badge.
- **DoD**: validator + golden + stories green for all deep packs; standard packs pass validator and S1/S5.

## Phase 11 — Hardening & packaging
- Performance budgets, a11y sweep, security suites, Docker image, compose, `pnpm doctor`, RUNNING.md, presenter guide (`docs/PRESENTER.md`), optional Snowflake adapter + deploy script.
- **DoD**: all of `10` §1 targets met; image < 300 MB; cold start to ready < 20 s with prebuilt warehouses.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pack content volume (largest effort) | Convert from predecessors, not invent; validator quotas; Pack Drafter for later packs |
| Live LLM numbers disagree with golden | MetricQuery-only tools + result_id rendering + grounding validator + auto fallback |
| DuckDB vs Snowflake dialect drift | Display translator; Snowflake adapter golden agreement test (Phase 11) |
| Scope creep across 13 modules | MVP cut (Phases 0–7 + 9); stories define what must be polished |
| Demo fragility | Snapshots, checkpoints, deterministic scripted mode, `pnpm doctor` |
