# 00 — Source Repository Review & Reuse Map

Reviewed 2026-10-05 at `main` HEAD of each repo. This document explains *why* Keystone looks the way it
does and tells Claude Code exactly what to port from where.

## 1. Summary of the three predecessors

| | AI-Ready-Data-Platform-Demo | AgenticDataProductManagement (ADPM) | Enterprise-Data-Product-AI-Agent-Marketplace |
|---|---|---|---|
| **Thesis** | One platform carries all nine layers an AI agent needs | Agents act, humans decide — governed 12-stage data-product lifecycle | Data products and the agents that run on them as one governed supply chain |
| **Size** | ~40K LOC TS, 240 files | ~22.5K LOC TS + 4K YAML, 214 files | ~49K LOC Py+TS, 1,021 files |
| **Stack** | Vite + React 18 SPA, Zustand, no backend | Next.js 15, Prisma (SQLite/Postgres), next-auth | Next.js 15 portal + FastAPI + Postgres/pgvector + Redis |
| **Data** | In-browser seeded PRNG rows, `MockSnowflake` facade | Metadata only (no warehouse); CSV profiling upload | Deterministic SQL-generated demo tier in Postgres |
| **AI** | None — TF-IDF matcher over 15 scripted scenarios/pack | Anthropic SDK single JSON call + offline heuristic provider | None by default — deterministic KPI→SQL planner; Cortex runtime untested |
| **Industries** | 8 deep packs (utilities, telecom, retail, banking, insurance, healthcare, manufacturing, public sector) | 9 packs (+generic, public sector) — lifecycle/metadata depth | 9 industries (+technology, transportation, energy) — 23 products, 30 agents, 112 KPIs |
| **Best at** | Visual storytelling, consistency of numbers, persona governance everywhere, readiness/ops engines, offline single-file demo | Lifecycle rigour, gates/cascade, provenance, artifacts, exports, teaching | Marketplace UX, agent manifests & KPI coverage, citations/refusals, publish gate, eval harness, mesh, value cases |
| **Weakest at** | No real AI, no persistence, hand-coded per-pack TS content | No conversation over products, no warehouse, plain UI | No generative AI, broken MCP servers, heavy process overhead, Python+TS split |

## 2. Overlap (build once in Keystone)

| Capability | AI-Ready | ADPM | Marketplace | Keystone decision |
|---|---|---|---|---|
| Industry content model | `IndustryPack` (TS functions) | `packs/*.yaml` (Zod) | `manifests/*` (YAML + JSON Schema) | **Declarative YAML+SQL pack**, Zod-validated, superset of all three (`04-industry-packs.md`) |
| Data product record | status, gates, contract YAML | 12-stage lifecycle + 25 artifacts | contract, quality, consumption, value | One `DataProduct` with lifecycle *and* marketplace facets |
| Agent record | tools, instructions, eval | lifecycle agents (registry) | manifest: coverage, bindings, guardrails, budgets | Two families: **Domain Agents** (marketplace manifest shape) and **Lifecycle Agents** (ADPM registry shape) |
| Certification | 8 gates, worst-check-wins | Stage 11 scorecard (DATSIS+V) | publish gate (8 checks) | Stage 11 gate fed by 8 **certification checks** (AI-ready) + agent **publish gate** (marketplace) |
| Access request | request → steward approve | request → decide | policy preview → approval steps | Marketplace flow with policy preview, single approval path |
| Answer engine | matcher → scenario `run()` → trace | — | KPI planner → SQL → citations | **Scenario/LLM → MetricQuery → compiler → QueryService** (one path, two front-ends) |
| Quality score | DMF results per object | quality-rules artifact | rubric-driven score snapshots | Rubric-driven score from DuckDB-executed DQ rules |
| Industries | 8 | 9 | 9+ | Union of 11; 4 deep in MVP, rest in Phase 10 |

## 3. Unique strengths to preserve

**From AI-Ready:** nine-layer Platform Map with animated flow; Snowsight-style Explorer; "How I
answered" layer trace; persona switch that changes masking/row filters on every screen; Layer
Knockout; Raw-vs-AI-Ready compare; 21-question readiness assessment (7 weighted dimensions, 5 bands);
roadmap generation; coverage levels 0–6; incident "Break something" with blast effects into agents;
agent-quality loop (thumbs-down → steward adds rule → eval 88%→94%); cost what-ifs; impact analysis;
two scripted 15-minute stories with Playwright tests per pack; single-file offline build.

**From ADPM:** 12 stages with exit criteria, gate quorum/veto, cascade-to-STALE, content-hashed
artifact versions, field-level provenance, agent autonomy L0–L3 (lower-only), redaction and budget,
Run Console orchestrator, intake wizard ("what decision are you blocked on?") with duplicate
detection and triage SLA, WSJF/RICE portfolio, 6-dimension maturity, standards adapters (ODCS,
OpenLineage, ODPS, DCAT), Word evidence pack, guided tours that drive the real UI.

**From Marketplace:** agent manifest with KPI coverage (grains, slices, analysis depth), column-level
product bindings, guardrails and budgets; refusal that names the agent who *can* answer; publish
gate with structured results; evaluation suites (golden, groundedness, boundary, adversarial,
entitlement, compositional); release/canary/rollback; data mesh + agent mesh with blast radius;
public demand board with votes and duplicate check; value cases with assumptions and measurement;
landing "answer theatre", constellation, live activity ticker; hybrid search across products, agents,
KPIs; rubrics holding every threshold.

## 4. Gaps none of them close (Keystone must)

1. **Real conversational AI** over governed data with tool use, streaming and grounding validation —
   without losing determinism (dual-mode runtime).
2. **A single executed warehouse** so SQL shown is SQL run (DuckDB), across Explorer, agents and DQ.
3. **One continuous story** from "business user is blocked" → lifecycle → certified product → agent
   built on it → question answered → incident → fix → value measured.
4. **Customer personalisation in minutes** — white-label branding, company re-skin, and an LLM-assisted
   pack drafter for an industry/company not yet covered.
5. **Persistence + reset** — approvals survive the session; one click restores the starting state.
6. **Agent Factory** — compose a new agent from certified products + KPIs live in front of a client,
   evaluate it, pass the publish gate, release it.
7. **Packaging** — Docker + one-command local run; no Python, no Redis, no external DB required.

## 5. Reuse map (port these — paths relative to each repo root)

### 5.1 AI-Ready-Data-Platform-Demo (`ai-ready-data-platform-demo/`)

| Keystone module | Port from | Notes |
|---|---|---|
| Core types (reference only) | `src/types.ts`, `src/ext/types.ts`, `src/layers.ts` | Becomes Zod schemas in `src/lib/packs/schema.ts`; replace `rows()` functions with generator specs |
| Readiness engine + UI | `src/ext/readiness.ts`, `src/features/implement/Readiness.tsx` | Port verbatim (pure functions); keep dimensions, weights, bands, presets |
| Roadmap / Build Guide / Coverage | `src/ext/roadmap.ts`, `src/ext/buildGuide.ts`, `src/ext/coverage.ts` | Pure TS, port verbatim; coverage must read live lifecycle state |
| Health / Quality / Cost / Impact / Knockout / RACI | `src/ext/{health,quality,cost,impact,knockout,raci}.ts` | Pure TS; re-point data access to `QueryService` |
| Certification checks + contract YAML | `src/packs/shared/product-kit.ts`, `src/lib/certification.ts` | 8 checks become automated inputs to Stage-11 gate |
| Matcher + responder + trace | `src/agents/engine/{matcher,respond,runScenario,trace}.ts` | Becomes `src/lib/agents/scripted/*`; scenario `run()` replaced by `MetricQuery` |
| Policies / DDL renderer / PRNG | `src/mock-snowflake/{policies,ddl,rng,generators}.ts` | Policies move into `QueryService`; DDL renderer emits Snowflake-dialect DDL for display |
| UI kit pieces | `src/components/{ui,LineageGraph}.tsx` | Re-implement on shadcn + @xyflow; keep interaction design |
| Shell, presenter menu, palette, demo script | `src/app/{TopBar,CommandPalette,demoScript}.ts(x)` | Becomes `(presenter)` + shell |
| Pack content | `src/packs/<id>/*` (8 packs) | **Content source** for Phase 1/10 conversion (scenarios, glossary, rules, KPIs, personas, incidents) |
| Pack validator idea | `src/packs/validate.ts`, `scripts/validate-pack.ts` | Re-implement against YAML pack; keep the ~500 checks/pack ambition |

### 5.2 ADPM (`agenticdataproductmanagement/`)

| Keystone module | Port from | Notes |
|---|---|---|
| Stage registry + exit criteria | `src/lib/lifecycle/stages.ts`, `criteria.ts` | Port verbatim; add `phase` grouping and a `demoDepth` flag |
| Gate engine + cascade | `src/lib/lifecycle/transitions.ts`, `cascade.ts`, `context.ts` | Port verbatim with tests (`tests/gate-engine.test.ts`, `lifecycle.test.ts`) |
| Artifact registry + commit/diff | `src/lib/artifacts/{registry,commit,diff,serialise}.ts` | Drop filesystem mirror (hosting blocker B3) |
| Lifecycle agents | `src/lib/agents/{registry,runtime,orchestrator,redaction,heuristics,models}.ts` | Upgrade provider to tool-use + streaming; keep heuristics as offline provider |
| Intake + duplicates | `src/lib/requests/{intake,duplicates}.ts`, `src/app/(app)/request/new/wizard.tsx` | |
| Portfolio + maturity | `src/lib/portfolio/{scoring,maturity}.ts` | |
| Standards + exports | `src/lib/standards/*`, `src/lib/exports/{docx,xlsx,audit}.ts` | Evidence pack (docx), ODCS/OpenLineage export |
| Prisma schema | `prisma/schema.prisma` | Basis for lifecycle tables in `03-data-model.md` |
| Packs (lifecycle depth) | `packs/*.yaml` | Domains, controls, sample decisions, platform profiles merge into Keystone pack |
| Guided tour | `src/components/tour.tsx`, `src/lib/guides/registry.ts` | |
| Run Console | `src/app/(app)/run-console/console.tsx`, `src/lib/agents/orchestrator.ts` | Becomes "Autopilot" in Product Studio |

### 5.3 Marketplace (`enterprise-data-product-ai-agent-marketplace/`)

| Keystone module | Port from | Notes |
|---|---|---|
| Agent manifest shape | `manifests/agents/*.yaml`, `manifests/schemas/*.schema.json` | Becomes `packs/<id>/agents/*.yaml` |
| KPI + product manifests | `manifests/kpis/*`, `manifests/products/*` | Content source for banking/insurance/telecom/tech/transport KPIs |
| Analytic planner (KPI→SQL) | `services/agent_runtime/{analytic,planner}.py` | Translate to TS as `src/lib/agents/scripted/planner.ts`; remove `COHORT_MARKERS` hardcoding (move to pack) |
| Grounding, entitlement, publish gate, evaluation, release | `services/agents/{grounding,entitlement,publish_gate,evaluation,release}.py` | Translate to TS; keep check IDs and thresholds (move thresholds to rubrics) |
| Rubrics | `manifests/rubrics/*`, `services/common/rubrics.py` | `packs/_shared/rubrics.yaml` |
| Hybrid search (RRF) | `services/search/hybrid.py` | Reimplement over MiniSearch + facet filters |
| Mesh + blast radius | `services/mesh/{data,agents,divergence}.py` | |
| Access policy evaluation, demand, assessment | `services/workflow/{access,policy,demand,assessment}.py` | |
| Value model + FinOps | `services/value/{model,finops}.py` | |
| Synthetic framework | `seed/synthetic/framework.py`, `seed/synthetic/products.py` | Generator spec vocabulary → `04-industry-packs.md` §5 |
| Golden answers / eval cases | `seed/golden/`, `seed/eval/` | Fixture source for `tests/golden/` |
| Portal components (design reference) | `portal/components/agents/{AnswerPanel,TraceRail,RefusalPanel,AgentCard}.tsx`, `portal/components/catalog/*`, `portal/components/landing/{Constellation,AnswerTheatre,ProductRibbon,IndustrySelector}.tsx`, `portal/components/ui/QualityRing.tsx` | Same stack — port and restyle |
| Design tokens | `portal/styles/tokens/*.css` | Base token set; brand overrides applied on top |

### 5.4 Do **not** carry over

- Marketplace: Python services, Redis, pgvector, RLS role split, 14-step verify pipeline, "no magic
  numbers / no brand strings" lints beyond invariant 1, generated MCP servers (broken).
- ADPM: next-auth credentials + passwords, `.adpm-secrets.json`, workspace filesystem mirror.
- AI-Ready: HashRouter, sessionStorage persistence, per-pack TS row generators, hand-rolled charts.
