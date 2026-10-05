# Keystone — Spec Pack

Build specification for **Keystone: AI-Ready Data Product & Agent Exchange**, a cross-industry
customer-demo prototype that merges:

- [AI-Ready-Data-Platform-Demo](https://github.com/CloudKatasani/AI-Ready-Data-Platform-Demo) — nine-layer platform, industry packs, readiness & operate engines
- [AgenticDataProductManagement](https://github.com/CloudKatasani/AgenticDataProductManagement) — governed 12-stage lifecycle, supervised-autonomy agents
- [Enterprise-Data-Product-AI-Agent-Marketplace](https://github.com/CloudKatasani/Enterprise-Data-Product-AI-Agent-Marketplace) — product + agent marketplace, cited answers, publish gate, evaluation

## The idea in one paragraph

One application, any industry: pick a pack (Utilities, Banking, Healthcare, Retail, then Insurance,
Telecom, Manufacturing, Public Sector, Technology, Transportation), brand it for the client, and walk a
story from raw Bronze data → governed lifecycle where agents draft and humans approve → certified data
product in a marketplace → domain agent that answers with cited, persona-governed numbers → incidents,
quality fixes, cost and value → readiness score and roadmap. Every number comes through one governed
query path over a real (DuckDB) warehouse, so Explorer, Playground, KPI tiles and agents always agree.
Agents run deterministically offline (Scripted) or with Claude tool-use (Live), falling back gracefully.

## Files

| File | Contents |
|---|---|
| `CLAUDE.md` | Binding build contract: stack, invariants, vocabulary, layout |
| `docs/PROMPT.md` | Kickoff prompt for Claude Code + per-phase prompts |
| `docs/build-spec/00-source-review.md` | Review of the three repos, overlaps, gaps, **file-level reuse map** |
| `01-functional-spec.md` | Personas, IA, 13 modules with acceptance criteria |
| `02-architecture.md` | System design, ADRs, core interfaces, flows, config, security |
| `03-data-model.md` | Prisma schema, warehouse layout, derived values |
| `04-industry-packs.md` | Pack catalogue, file layout, schemas by example, generator, validator, conversion checklist |
| `05-query-and-semantic-engine.md` | Metric compiler, policy engine, SQL safety, DQ, profiling, search |
| `06-lifecycle-and-governance.md` | 12 stages, gates, certification checks, autopilot, access, intake, exports |
| `07-ui-ux.md` | Design system, shell, key layouts, component inventory, a11y |
| `08-agents-llm.md` | Agent families, manifest, scripted & live engines, tools, grounding, eval, publish gate |
| `09-presenter-and-stories.md` | Six demo stories, presenter overlay, profiles, personalisation |
| `10-testing-and-quality.md` | Test pyramid, golden workflow, CI, Definition of Done |
| `11-build-plan.md` | 12 phases with deliverables and DoD; MVP cut; risks |
| `12-deployment.md` | Local, Docker, shared server, ops, Snowflake adapter |
| `packs/_shared/rubrics.yaml` | Starter thresholds/weights (ported from predecessors) — copy into the repo in Phase 0 |

## How to use

1. New empty repo → copy `CLAUDE.md`, `docs/` and `packs/_shared/` in.
2. Clone the three source repos into `../reference/`.
3. Open Claude Code in the repo, paste `docs/PROMPT.md` (below the line). Approve phase by phase.
