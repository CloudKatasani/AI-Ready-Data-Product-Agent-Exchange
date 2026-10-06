# Phase 2 — Governed query path & knowledge screens

Status: **complete, awaiting "continue"**. Date: 2026-10-06.

## Built

| Deliverable | Where |
|---|---|
| **Metric compiler**: the only producer of metric SQL. MetricQuery → DuckDB SQL with bound parameters. It covers 6 analysis shapes (value, by-dimension/rank, trend, contribution, distribution, compare-target), business-rule default filters with question-based opt-out, relative windows on the pack clock, slice-aware denominators (`scope_exprs`), deterministic ordering, and "did you mean" suggestions | `src/lib/query/compiler.ts`, `time.ts` |
| **Policy engine**: entitlements (product-based; raw layers by role; steward bypass logged; executives aggregates-only), row access, masking (DuckDB macros; masking pending a certification fix stays off), limits. Incident effects are stubbed until Phase 7 | `src/lib/query/policies.ts` |
| **QueryService**: one governed path for metric, preview and worksheet requests. Every call writes one append-only QueryLog row | `src/lib/query/query-service.ts`, `query-log.ts`, `connections.ts` |
| **Worksheet SQL safety** using DuckDB's own parser (ADR-0014): one SELECT only, deny-listed and table functions rejected, table references rewritten through the policy engine by exact offset | `src/lib/query/sql-safety.ts` |
| **Display SQL** (Snowflake dialect): database-qualified names, `::DATE`, `PERCENTILE_CONT … WITHIN GROUP`, and policy/rule comments | `src/lib/query/display-sql.ts` |
| **Prisma models** (Persona, Entitlement, QueryLog, AuditEvent with hash chain, KnowledgeOverlay), first migration, seed from the pack | `prisma/`, `src/lib/db/`, `src/lib/presenter/seed.ts`, `pnpm db:setup` |
| **Persona switcher**: five persona cards, signed httpOnly cookie, `Ctrl+Shift+P`, "Now viewing as…" toast; the shell shows the company and pack clock | `src/components/shell/persona-switcher.tsx`, `src/lib/presenter/session.ts` |
| **Launcher** lists installed packs | `src/app/(presenter)/launch` |
| **Explorer**: tree over the 9 layer schemas (66 objects); Preview (governed), Columns (tags, terms, masking for you), DDL (Snowflake: Iceberg/Dynamic Tables/semantic view with attached policies), Lineage graph (@xyflow + link lists), Quality (declared DQ rules), Governance (products, policies, entitled personas, access history from QueryLog); Worksheet with presets | `src/app/[pack]/(builder)/explorer/` |
| **Semantic**: view list; Model (Mermaid ER diagram + dimensions), Metrics, Verified queries, YAML (Snowflake semantic-view export), **Playground** (metric/dimension/grain/range/filter → chart + table + rules + policies + display SQL + "Ask an agent this") | `src/app/[pack]/(builder)/semantic/` |
| **Glossary**: filterable list; term detail with owner/steward, CDE, synonyms, mapping strip (columns → metrics → products → agents) and DQ rules | `src/app/[pack]/(builder)/glossary/` |
| **Context**: instructions, business rules (with machine-applied filters), verified queries, synonyms, **document search** (MiniSearch BM25 over ~600-char chunks, synonym expansion, highlighted hits; planted-injection documents flagged) | `src/app/[pack]/(builder)/context/`, `src/lib/marketplace/search.ts` |
| Validator category 4 extended: every metric compiles and returns a value; every verified query executes | `src/lib/query/validate.ts` |
| Invariants **I02, I03, I11** implemented (I01, I08 from Phase 1) | `tests/invariants/` |
| Calibri font (ADR-0013) | `src/app/globals.css` |

## Definition of Done

| Check | Result |
|---|---|
| **AC8.1**: same object preview masked for persona B, clear for D | ✅ e2e `governed-screens.spec.ts` + integration test |
| **AC8.2**: non-SELECT rejected with a friendly message, nothing executes | ✅ e2e + 9 integration cases (DROP, COPY, ATTACH, chained statements, `read_csv`, `current_setting`, `query()`, unqualified and unknown objects); no QueryLog row is written for a rejected query |
| **AC9.1**: Playground value for each headline KPI equals the KPI tile | ✅ integration test over all 4 headline KPIs: identical SQL and value. The comparison against the agent's golden answer is added in Phase 3 when golden files exist |
| Validator categories 4–6 fully green | ✅ **3,904 checks, 0 errors, 0 warnings** (category 4 now runs all 43 metrics and 54 verified queries through QueryService) |
| Invariants I02, I03, I11 | ✅ |
| typecheck / lint / tests | ✅ / ✅ (no-domain-strings 0 violations) / ✅ **128 passed**, 25 todo (later-phase invariants) |
| build / e2e + a11y | ✅ / ✅ **87 passed** (WCAG 2.2 AA axe on every built screen; planted API key never reaches the browser) |

## Requested demonstrations

### One object previewed as persona B (masked) and persona D (clear)
`CURATED_SILVER.CUSTOMER` (first 3 rows, selected columns). Persona B (Reliability Analyst) masked columns: first_name, last_name, email, phone, street_address.

Persona B:

| customer_no | first_name | last_name | email | phone | region |
|---|---|---|---|---|---|
| C000000004 | ••• | ••• | 76d342@examplemail.com | •••-•••-0135 | West |
| C000000010 | ••• | ••• | 406deb@examplemail.com | •••-•••-0180 | South |
| C000000024 | ••• | ••• | eeddac@examplemail.com | •••-•••-0197 | North |


Persona D (Customer Data Steward):

| customer_no | first_name | last_name | email | phone | region |
|---|---|---|---|---|---|
| C000000004 | Diego | Lewis | diego.lewis3@examplemail.com | +1-216-555-0135 | West |
| C000000010 | Nancy | Smith | nancy.smith9@examplemail.com | +1-911-555-0180 | South |
| C000000024 | Joseph | Nguyen | joseph.nguyen23@examplemail.com | +1-275-555-0197 | North |

Screenshots: `img/phase-2-explorer-persona-B-masked.png`, `img/phase-2-explorer-persona-D-clear.png`.

### Playground: SAIDI by region, last quarter (Q3 2026)

| Region | SAIDI (min) |
|---|---|
| East | 58.8 |
| South | 36.9 |
| Central | 32.6 |
| North | 26.5 |
| West | 17.6 |

Display SQL as shown in the Playground:

```sql
-- BUSINESS RULE BR-UTL-012: Reliability indices exclude IEEE 2.5-beta major event days unless explicitly requested.
SELECT
  f.region AS "region",
  SUM(o.customer_minutes) / MAX(f.region_customers_served) AS "saidi"
FROM NVE_AI_PLATFORM.CONFORMED_GOLD.FCT_OUTAGE o
JOIN NVE_AI_PLATFORM.CONFORMED_GOLD.DIM_FEEDER f ON o.feeder_key = f.feeder_key
JOIN NVE_AI_PLATFORM.CONFORMED_GOLD.DIM_DATE d ON o.date_key = d.date_key
WHERE o.major_event_day = FALSE
  AND d.date BETWEEN '2026-07-01'::DATE AND '2026-09-30'::DATE
GROUP BY f.region
ORDER BY "saidi" DESC, f.region ASC
LIMIT 50
```

The same question asked by persona A (North row filter) returns **26.5**. That matches North in the table above, because the regional customers-served denominator is selected automatically. Screenshot: `img/phase-2-playground-saidi-by-region.png`.

## Deviations and decisions (please review)

1. **Font → Calibri (your request; ADR-0013).** Calibri is licensed and can't be bundled. The stack is Calibri → Carlito (metric-compatible, OFL) → system font, and nothing is fetched at runtime.
2. **SQL safety uses DuckDB's parser, not `node-sql-parser` (ADR-0014)**, which is outside the §3 stack. The worksheet editor is a `<textarea>`; CodeMirror is also outside the stack.
3. **Metric joins are INNER joins**, so a row filter on a dimension table correctly removes fact rows; Gold foreign keys are always populated.
4. **Masking on metric results is applied to the projection, not the grouping.** Masked customer names still produce one row per customer.
5. **Raw layers (Bronze/Silver) are visible by role** (analyst, engineer, product owner, steward), not by product entitlement. Gold, semantic and product objects need a product entitlement, except for stewards, whose bypass is logged.
6. **Executive persona E now has aggregate access to all six non-draft products.** Otherwise the story S1 Home tiles (DSO, AMI read) would be denied. This is a pack content change.
7. **GOVERNANCE.ACCESS_HISTORY in DuckDB is not written yet.** The warehouse is opened read-only by the app; access history is read from the app DB QueryLog. A warehouse sync arrives with `sync.ts` in Phase 5.
8. **SQLite path**: `DATABASE_URL=file:../data/keystone.db`, relative to `prisma/` per Prisma's convention, so the DB lives in `data/` with the warehouses.
9. **No new dependencies** beyond §3 (`recharts`, `@xyflow/react`, `mermaid`, `minisearch`, `@duckdb/node-api` were all listed).

## Open items
- Incident effects (overlay views) are stubbed in the policy engine and covered in Phase 7.
- The Quality tab shows declared rules only; scores and results come with the DQ engine in Phase 5.
- The Request CTA links to the marketplace product page, which is a stub until Phase 4.

## Screenshots
`img/phase-2-explorer-persona-B-masked.png` · `img/phase-2-explorer-persona-D-clear.png` · `img/phase-2-playground-saidi-by-region.png` · `img/phase-2-worksheet-rejected.png` · `img/phase-2-lineage.png` · `img/phase-2-semantic-model.png` · `img/phase-2-glossary-term.png` · `img/phase-2-context-search.png`
