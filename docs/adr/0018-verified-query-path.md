# ADR-0018 — Verified queries as a scripted answer path

Status: Accepted (Phase 6)

## Context
The eval harness (08 §5) puts every active verified query for an agent's KPIs in the golden suite.
Running it across the four deep packs showed the scripted planner misreading a small share of them:
- "share of customers at high churn risk" planned as average churn risk;
- "how many bills were issued" fell to clarify;
- an agent answered a KPI it doesn't cover because a curated scenario's generic wording ("trended
  month by month") matched.

Verified queries are, by definition, reviewed question → MetricQuery pairs. Snowflake Cortex Analyst
uses its verified query repository the same way.

## Decision
- Order: guardrails → curated scenario **or verified query** → redirect → planner → clarify → help.
  - A TF-IDF matcher over active verified-query questions (`src/lib/agents/scripted/verified.ts`)
    considers only queries over metrics the agent covers.
  - A verified query wins over the curated match only when it scores strictly higher; only an
    exact question scores 1.
  - A near match must name one of its metrics. An exact verified match overrides a partial
    out-of-scope hit, as a curated scenario does.
  - The query still runs through `QueryService`, and the verified query is cited.
- Answer templates for a MetricQuery come from one function (`describeQuery`), shared by the planner
  and the verified path.
- Scenario fit: if the question names a metric the agent does not cover, a curated or verified match
  must use that metric. Otherwise the agent redirects or declines.
- Grounding strips digits that belong to names before checking numbers. Names here are metric
  labels, KPI names and string cells such as "30+ days past due" or a "90+ DPD" bucket.
- Totals used by a template are part of the answer's governed result (`result.totals`), so the
  numbers they produce are grounded.

## Consequences
- The golden suite now also tests the verified-query matcher, not only the planner. The planner is
  still exercised by paraphrases, curated-scenario fallbacks and free-text tests.
- Adding a verified query (an Agent Quality fix type) changes scripted answers immediately, which is
  the intended quality loop.
