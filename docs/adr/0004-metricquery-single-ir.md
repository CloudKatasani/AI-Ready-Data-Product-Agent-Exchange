# ADR-0004 — MetricQuery as the single intermediate representation

- Status: Accepted (Phase 0; implemented Phase 2)
- Source: `02-architecture.md` §2 and §4, `05-query-and-semantic-engine.md` §1

## Context
Predecessors computed the same KPI in several places (scripted scenario code, planner SQL, UI tiles),
which let numbers disagree.

## Decision
Scripted scenarios, LLM tool calls, the Semantic Playground, Knockout and KPI tiles all express a
question as a `MetricQuery`, and `compileMetricQuery()` is the only producer of metric SQL
(invariant I03). Execution always goes through `QueryService.run()` (invariant I02).

## Consequences
- The same question returns the same number on every surface; golden files pin it.
- LLM tools never receive raw SQL authority — they submit MetricQuery JSON.
