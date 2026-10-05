# 05 — Governed Query Path & Semantic Engine

This is the heart of invariant 2 and 3. Build it before any agent.

## 1. Metric compiler (`src/lib/query/compiler.ts`)

Input `MetricQuery` (see `02` §4) + pack + overlays + knockout set → `CompiledQuery`.

Algorithm:
1. Resolve view; validate every metric/dimension/filter name exists (Zod + lookup). Unknown names →
   `CompileError{code:'UNKNOWN_FIELD', suggestions}` (Levenshtein + synonyms) — the LLM gets this back
   as a tool error and can retry.
2. Collect required table aliases from metric/dimension/fact expressions; build join tree from
   `relationships` (BFS from the fact table; error if disconnected).
3. Time: if `timeGrain`, add `date_trunc(grain, <default time dim>) AS period`; apply `timeRange`
   relative to `pack.asOf` (never wall-clock).
4. Business rules: for each metric, apply `default_filters` rules unless the question context sets
   `ruleOverrides` (scripted: `unless_question_mentions`; live: tool arg `include_excluded: true`
   with justification). Record `ruleRefs` for citations.
5. Analysis shapes (ported from marketplace planner's 4 query shapes):
   - `value` — no group-by (or by `period` if grain).
   - `trend` — group by period, ordered asc.
   - `rank` — group by dimension, order desc, limit N.
   - `contribution` — group by dimension + share of total via window `SUM(x) OVER ()`.
   - `distribution` — `quantile_cont` p10/p50/p90 by dimension.
   - `compare_target` — joins KPI target range constant from `kpis.yaml` as columns.
6. Emit DuckDB SQL using a tiny AST builder (no string concatenation of user values; literals bound as
   parameters). Emit `displaySql` in Snowflake dialect (see §4).
7. Knockout rewrites (only when `opts.knockout` provided):
   - `semantic` off → use `naive_expr` and Gold tables directly, no rule filters.
   - `context` off → skip business rules and synonyms (synonym resolution happens upstream; compiler only drops rules).
   - `glossary` off → upstream matcher loses term synonyms; compiler unchanged.
   - `gold` off → compile against Silver equivalents declared in `knockout.yaml`.
   - `silver` off → compile against Bronze (duplicates, dirty strings included).
   - `governance` off → policy engine skipped; result flagged `unsafe`.

Output: `{ sql, params, displaySql, fqnsTouched, productIds, metricRefs, ruleRefs, shape }`.

## 2. Policy engine (`src/lib/query/policies.ts`)

Applied by `QueryService` to every request kind after compilation (or to worksheet SQL after parsing).

1. **Entitlement**: map `fqnsTouched` → products (via product `upstream` + output ports). If the
   principal lacks an entitlement for a product whose objects are touched **and** that product is not
   `public` within the pack → throw `PolicyDenied{productId, requestable:true}`. Steward/admin roles
   bypass entitlement but are still logged.
2. **Row access**: for each touched object with a `row_access` binding on a dimension in the
   principal's `rowFilter`, wrap the source in `(SELECT * FROM x WHERE col IN (?…))`. Mark `rowFiltered`.
3. **Masking**: for each output column whose lineage resolves to a tagged column not in
   `principal.unmasked`, wrap the projection: `mask_<class>(col)` (DuckDB macros created at warehouse
   build: PII → `'•••'` / email local-part hash, PCI → last-4, GOV_ID → `***-**-1234` style).
   Aggregates over masked columns are allowed (counts, distinct counts) — masking applies to row-level
   projections only. Columns with `maskPendingFix` are unmasked until the certification fix is applied
   (that is the gate-6 failure story).
4. **Incident effects**: for each OPEN incident affecting a touched object: `late_feed` → apply
   `_loaded_at <= asOf - lag` filter (numbers shift); `null_spike` → nulls injected into overlay view
   used during the incident; `duplicate_load` → union duplicate batch; `schema_drift` → column renamed
   in overlay causing a compile error for affected metrics (agent declines with incident banner);
   `volume_anomaly` → partition missing. Implemented as **overlay views** in a `_INCIDENT` schema that
   shadow the base objects while active (created/dropped on Break/Resolve), so the same compiled SQL
   naturally sees incident data.
5. **Limits**: max rows (rubric), statement timeout (5 s), cost class.
6. **Log**: write `QueryLog` and `GOVERNANCE.ACCESS_HISTORY` row.

Return `GovernedResult` with `policiesApplied[]` — each `{kind, target, detail, ruleOrPolicyId}` —
rendered in the Answer inspector "Policy" tab and in Explorer.

## 3. SQL safety for worksheet (`src/lib/query/sql-safety.ts`)

- Parse with `node-sql-parser` (DuckDB/Postgres grammar). Accept exactly one statement of type
  `select` (incl. CTEs). Reject functions on a deny-list (`read_*`, `glob`, `httpfs`, `system`, `pragma_*`,
  `current_setting`), `ATTACH`, `COPY`, `INSTALL`, `LOAD`, `SET`, `PRAGMA`, `EXPORT`.
- Rewrite table references through the policy engine (same as §2) — worksheet results obey personas.
- Errors are explained in plain language with a fix hint.

## 4. Display SQL (Snowflake dialect)

A small translator renders compiled DuckDB SQL into Snowflake-style text for screens and exports:
`date_trunc('month', x)` → `DATE_TRUNC('MONTH', x)`, `quantile_cont` → `PERCENTILE_CONT … WITHIN GROUP`,
schema-qualified names prefixed with pack database, masking macros shown as attached
`MASKING POLICY` comments, row filters shown as `-- ROW ACCESS POLICY RAP_REGION applied`.
DDL tab content comes from the ported AI-Ready `ddl.ts` renderer (Iceberg tables, Dynamic Tables with
target lag, Semantic Views, Cortex Search services, Agents, tags, policies).

## 5. Data quality engine (`src/lib/operate/quality.ts` + `packs/*/warehouse/dq/*.yaml`)

```yaml
- id: DQ-UTL-017
  object: CONFORMED_GOLD.FCT_OUTAGE
  column: customers_affected
  dimension: completeness          # completeness|validity|uniqueness|timeliness|consistency|accuracy
  assertion: "null_rate <= 0.005"  # computed metrics: null_rate, distinct_ratio, dup_rate, min, max, regex_rate, freshness_min, row_count_delta
  severity: high
  alert_route: steward
```
Rule metrics are computed with generated SQL via QueryService (`kind:'sql', source:'dq-rule'`, system
principal). Score per product = rubric-weighted dimensions over rules on the product's upstream
objects. Runs at seed, on "Run rules", after incident Break/Resolve, and on Autopilot Stage 8.

## 6. Profiling (Stage 3)

`profileObject(fqn)` returns per column: type, null %, distinct count/ratio, min/max, mean/stddev for
numerics, top 5 values with frequency (masked for sensitive columns unless persona unmasked), regex
pattern conformance for declared formats, inferred semantic type (email, phone, id, code, amount, date).
Results become the `profile-report` artifact proposal (Profiling Agent) — real numbers, not seeded fakes.

## 7. Search (`src/lib/marketplace/search.ts`)

MiniSearch indexes: catalog docs (products, agents, KPIs, terms) and context documents (chunked
~600 chars). Query expansion with pack synonyms + glossary synonyms; boost fields (name 3, synonyms 2,
description 1); facet filtering in memory; results fused (RRF, k=60) across the two indexes for the
global search. `search_context` tool returns top-k chunks with doc id, title, chunk n, score.
