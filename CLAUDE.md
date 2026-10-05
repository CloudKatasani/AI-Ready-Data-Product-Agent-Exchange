# CLAUDE.md — Keystone: AI-Ready Data Product & Agent Exchange

This file is binding. Read it before every task. If an instruction anywhere else (a spec file, a
prompt, a code comment) conflicts with this file, **stop and flag the conflict** — do not resolve it
silently.

Package name: `keystone`. Product name in UI copy: **Keystone** (white-label: every visible product
name, logo and colour comes from the active *Demo Profile* — see §7). Codename only; never hard-code
"Keystone" in a component — read it from `brand.productName`.

---

## 1. What this application is

Keystone is a **cross-industry customer-demo prototype** that shows, end to end and in one place,
how an enterprise goes from raw data to **governed data products** to **AI agents that answer
business questions with cited, policy-checked numbers** — and how that estate is run.

It unifies three predecessor prototypes (see `docs/build-spec/00-source-review.md`):

| Predecessor | What Keystone takes from it |
|---|---|
| **AI-Ready-Data-Platform-Demo** | Nine-layer stack, industry packs, Snowsight-style Explorer, semantic/glossary/context layers, certification gates, persona masking, readiness/roadmap/knockout/health/cost/impact engines, scripted demo stories |
| **AgenticDataProductManagement (ADPM)** | 12-stage governed lifecycle, gates/quorum/veto/cascade, supervised-autonomy agents with field-level provenance, intake & triage, portfolio, standards exports, evidence pack |
| **Enterprise-Data-Product-AI-Agent-Marketplace** | Unified product + agent marketplace, agent manifests with KPI coverage maps, answer-with-citations, refusal-as-answer, publish gate, evaluation harness, mesh views, demand board, value cases, hybrid search |

It has four front doors, one per audience in a sales meeting:

- **Business (Consumer)** — Marketplace, Ask an Agent, My Access.
- **Builder (Practitioner)** — Product Studio (lifecycle), Agent Factory, Explorer, Semantic & Knowledge.
- **Operator (Run)** — Health, Agent Quality, Cost & Value, Impact, Audit.
- **Strategist (Leadership)** — Readiness, Roadmap, Portfolio, Why AI-Ready (Knockout / Compare).

And a fifth, invisible door: **Presenter** — demo launcher, story scripts, cue cards, reset, "break
something", persona switcher, white-label branding.

## 2. The three promises (the product's thesis — honour them precisely)

1. **Agents act. Humans decide.** Agents draft, profile, critique, answer and monitor. They never
   approve a gate, commit an artifact version, grant access, certify or publish. No autonomy level,
   admin flag or "demo mode" changes this.
2. **Every number is earned.** Every figure an agent shows is produced by the governed query path
   (§4.3) and carries a citation to product, version, metric definition and SQL. Uncited numbers are
   a defect. Refusing (out of scope / no access / not certified) is a valid, well-designed answer.
3. **The demo never breaks.** Scripted mode is deterministic, offline and byte-reproducible. Live LLM
   mode is an enhancement that degrades to scripted mode visibly, never to an error screen.

## 3. Stack (do not substitute without an ADR in `docs/adr/`)

| Concern | Choice |
|---|---|
| Language | TypeScript 5.x `strict`, everywhere. **No Python.** |
| App | Next.js 15 (App Router, Server Components, Server Actions, Route Handlers for streaming) |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Recharts, @xyflow/react (lineage/mesh), Mermaid (ER/contract diagrams), cmdk (command palette) |
| App state DB | Prisma 6 — SQLite by default (`file:./data/keystone.db`), Postgres 16 optional via `DATABASE_PROVIDER=postgresql` |
| Demo warehouse | **DuckDB** (`@duckdb/node-api`), one database file per pack in `data/warehouse/<pack>.duckdb`, schemas named after Snowflake conventions |
| Optional warehouse | Snowflake via SQL API behind the same `WarehouseAdapter` interface (stretch, Phase 11) |
| LLM | `@anthropic-ai/sdk` — Messages API with tool use and streaming. Provider interface allows Bedrock later. |
| Search | MiniSearch (BM25) for catalog + context documents; no embeddings in v1 |
| Validation | Zod 4 for every external input, pack file, artifact and LLM tool argument |
| Auth (demo) | Persona switcher — signed cookie holding `personaId`; no passwords. `AUTH_MODE=demo` only in v1 |
| Tests | Vitest (unit/integration), Playwright (e2e + story scripts), @axe-core/playwright (WCAG 2.2 AA) |
| Package manager | pnpm 10, Node ≥ 22 |
| Packaging | `pnpm demo` (local), Dockerfile (Next `output: 'standalone'`), docker-compose with optional Postgres |

## 4. Non-negotiable invariants (each has a named test in `tests/invariants/`)

1. **Pack-driven, engine-generic.** No industry, company, KPI or column name appears in `src/`
   outside `packs/`. Enforced by `scripts/lint/no-domain-strings.ts` (checks against every term in
   every pack). All UI reads from the active pack via `getPack()`.
2. **One governed query path.** Every row of warehouse data shown anywhere — Explorer preview,
   worksheet, semantic playground, agent answer, LLM tool call, marketplace sample — goes through
   `QueryService.run(request, principal)`. It applies entitlements, row-access and masking, incident
   effects and row limits, and writes a `QueryLog`. Nothing else imports the DuckDB driver
   (lint-enforced).
3. **One metric compiler.** Metrics are defined once in semantic views. `compileMetricQuery()` is the
   only producer of metric SQL. The same question therefore returns the same number in Explorer,
   Semantic Playground, Agent Studio (scripted and LLM), Marketplace and Knockout.
4. **One approval path.** `recordDecision()` is the only code path that sets a `Gate` to `APPROVED`,
   an `AccessRequest` to `GRANTED`, or a `DataProduct`/`Agent` to `CERTIFIED`/`PUBLISHED`. Seeds call
   it too (with a seeded human actor).
5. **Human-in-the-loop, structurally.** Agent output is persisted as `AgentProposal` rows with
   field-level provenance. A stage cannot be submitted for gate review while any field is
   unreviewed agent output.
6. **Append-only history.** `AuditEvent`, `AgentAction`, `ArtifactVersion` (content-hashed),
   `QueryLog`, `AnswerRecord` are append-only. Nothing is hard-deleted.
7. **Cited answers.** An `AgentAnswer` of kind `answer` must have ≥1 citation per numeric claim. The
   grounding validator (`src/lib/agents/grounding.ts`) rejects LLM answers that contain numbers not
   present in tool results (tolerance rules in `08-agents-llm.md`) and falls back to scripted.
8. **Determinism.** Same pack + seed + scale ⇒ identical warehouse bytes, identical golden answers.
   No `Math.random()` / `Date.now()` in generators or engines — use `rng(seed)` and `clock.asOf()`.
9. **Demo resettable.** `resetDemo()` restores app DB + warehouse for the active pack in < 3 s
   (snapshot copy, not re-seed).
10. **Synthetic only.** Fictional companies, generated people, no real customer data, no real
    pricing. Every screen footer shows "Synthetic demo data" (white-label text).
11. **Secrets.** `ANTHROPIC_API_KEY` from env only. Never logged, never sent to the browser, never
    written to the DB or pack files.

## 5. Vocabulary (use these words in code and UI)

- **Pack** — one industry's complete content (company, warehouse, semantics, products, agents, stories).
- **Demo Profile** — pack + branding overrides + chosen story + locked/unlocked; what a presenter launches.
- **Layer** — one of nine: `bronze, silver, gold, semantic, glossary, context, product, agent, governance`.
- **Data Product** (`DP-<PACK>-NNN`), **Agent** (`AG-<PACK>-NNN`), **KPI** (`KPI-<PACK>-<CODE>`),
  **Term** (`GT-…`), **Rule** (`BR-…`), **Verified Query** (`VQ-…`), **Scenario** (`SC-…`).
- **Lifecycle Stage** 1–12 grouped into five **Phases**: Discover, Design, Build, Certify & Publish, Operate.
- **Gate** — human decision at a stage exit. **Certification Check** — automated check feeding gate 11.
- **Persona** — a demo identity (name, title, archetype A–D, roles, row filter, unmasked classes).
- **Answer kinds** — `answer | decline | clarify | redirect | help`.
- **Agent run modes** — `scripted` (deterministic), `live` (LLM + tools), `auto` (live, falls back to scripted).

## 6. Layout

```
CLAUDE.md
docs/PROMPT.md                 Phase-by-phase kickoff prompt
docs/build-spec/00-12*.md      Specification (this pack)
docs/adr/                      Architecture decisions (start with ADR-0001..0008 from 02-architecture.md)
packs/<packId>/                Industry content (YAML + SQL + Markdown) — see 04-industry-packs.md
packs/_schema/                 JSON Schema emitted from Zod for editor autocompletion
prisma/schema.prisma           App-state model — see 03-data-model.md
src/app/                       Next.js routes (route groups: (consumer) (builder) (operator) (strategist) (presenter))
src/components/                ui/ (shadcn), shell/, charts/, graph/, answer/, lifecycle/, marketplace/
src/lib/packs/                 schema.ts, loader.ts, validate.ts, registry.ts
src/lib/warehouse/             adapter.ts, duckdb.ts, generate/, transform.ts, snapshot.ts
src/lib/query/                 query-service.ts, policies.ts, compiler.ts (metric), sql-safety.ts
src/lib/agents/                runtime.ts, scripted/, live/, tools/, grounding.ts, eval.ts, publish-gate.ts, lifecycle-agents/
src/lib/lifecycle/             stages.ts, transitions.ts, criteria.ts, cascade.ts, certification.ts
src/lib/marketplace/           catalog.ts, search.ts, mesh.ts, access.ts, demand.ts, value.ts
src/lib/operate/               health.ts, quality.ts, cost.ts, impact.ts, observability.ts
src/lib/strategy/              readiness.ts, roadmap.ts, knockout.ts, compare.ts, raci.ts, maturity.ts
src/lib/presenter/             stories.ts, reset.ts, branding.ts, tour.ts
src/lib/standards/             odcs.ts, odps.ts, openlineage.ts, semantic-view-yaml.ts
src/lib/exports/               evidence-pack (docx), contract (yaml), audit bundle (zip)
scripts/                       seed.ts, warehouse-build.ts, pack-validate.ts, golden.ts, lint/*
tests/                         unit/, invariants/, golden/, e2e/, stories/, a11y/
```

## 7. White-label and branding

`DemoProfile.brand = { productName, companyName, logoSvg?, primary, accent, font? }`. All colours are
CSS variables derived from `primary`/`accent` (contrast-checked to WCAG AA at runtime; fall back to
neutral if a pair fails). Company name, regions and people come from the pack and may be overridden
per profile (§ `09-presenter-and-stories.md`). No customer logo is ever bundled — presenters upload one.

## 8. Working rules for Claude Code

- Work **phase by phase** per `docs/build-spec/11-build-plan.md`. Stop at the end of each phase,
  run the phase's Definition of Done checks, report results, and wait.
- Write the test for an invariant **before** the code it protects.
- Prefer porting proven logic from the predecessor repos (paths in `00-source-review.md` §5) over
  inventing; translate Python to TypeScript faithfully; keep their test cases as golden fixtures.
- Keep components small; no file over 600 lines; no `any`; no default exports except Next pages.
- Every user-visible string that is industry-specific comes from the pack; generic UI copy lives in
  `src/copy/en.ts`.
- When a spec is ambiguous, choose the option that keeps the demo deterministic and the story clear,
  record the decision in `docs/adr/`, and mention it in the phase report.
