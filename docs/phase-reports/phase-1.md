# Phase 1 — Packs & warehouse

Status: **complete, awaiting "continue"**. Date: 2026-10-06.

## Built

| Deliverable | Where |
|---|---|
| Zod schemas for every pack file (04 §2–3) + JSON Schema emit (28 files) | `src/lib/packs/schema/*.ts`, `packs/_schema/`, `pnpm pack:schema` |
| Loader (collects issues, never throws for content), registry with cache, `getPack()` | `src/lib/packs/loader.ts`, `registry.ts`, `index-pack.ts` |
| Deterministic generator: mulberry32 port, per-column seeded streams, all 04 §5 primitives (+ `date_offset`, `const`, `fk.dist: sequential`), safe formula evaluator (no `eval`), planted patterns, CDC noise (U duplicates, D tombstones, dirty strings, late arrivals) | `src/lib/warehouse/rng.ts`, `clock.ts`, `generate/`, `src/lib/packs/formula.ts` |
| `WarehouseAdapter` + DuckDB adapter (only driver import; external access off, config locked), Appender loads | `src/lib/warehouse/adapter.ts`, `duckdb.ts` |
| Build pipeline: 9 layer schemas, masking macros, `GOVERNANCE.as_of()`, Bronze → Silver SQL → Gold SQL → SEMANTIC base views → GLOSSARY/CONTEXT/DATA_PRODUCTS/AGENTS/GOVERNANCE objects; content-hash cache; per-table checksums | `src/lib/warehouse/build.ts`, `generated.ts`, `semantic-base.ts`, `pnpm warehouse:build` |
| Validator — categories 1–6, 9, 10 (7–8 need the compiler/agents, 11 needs golden) | `src/lib/packs/validate*.ts`, `src/lib/warehouse/validate.ts`, `src/lib/packs/dq.ts`, `pnpm pack:validate` |
| **Utilities pack** (Northvale Energy, `NVE_AI_PLATFORM`) converted from all three predecessors | `packs/utilities/` |
| Shared stories (6) and adversarial probes (15) | `packs/_shared/stories.yaml`, `adversarial.yaml` |
| Domain-string lint now reads real pack terms (126 terms) | `scripts/lint/no-domain-strings.ts` |
| Invariants **I01** and **I08** implemented | `tests/invariants/I01-*.test.ts`, `I08-*.test.ts` |
| CI: `pnpm pack:validate` step added | `.github/workflows/ci.yml` |
| ADR-0011 (relative time windows), ADR-0012 (schema additions) | `docs/adr/` |

### Utilities pack contents vs deep quotas

| Item | Built | Quota |
|---|---|---|
| Domains | 6 | 5–8 |
| Bronze / Silver / Gold | 17 / 17 / 14 | 14–20 / 12–18 / 10–14 |
| Semantic views / metrics | 8 / 43 | 4 / ≥ 24 |
| KPIs with target bands | 32 | ≥ 24 |
| Glossary terms (CDE) | 48 (23 = 48 %) | ≥ 26 (≥ 30 %) |
| Rules / active VQs / synonyms | 24 / 51 (+3 pending-fix) / 52 | ≥ 20 / ≥ 48 / ≥ 30 |
| Context documents | 8 (2 with planted injection lines) | ≥ 6 |
| Products | 8: 5 Certified, DP-UTL-005 In certification (cert demo), DP-UTL-007 In development (lifecycle demo), DP-UTL-008 Draft | 8 with that mix |
| Agents | 5: 4 Production + Data Steward Assistant (Pilot) | 5 |
| Personas / scenarios / incidents | 5 (A–E) / 23 covering patterns 1–15 / 5 (one per kind) | 5 / ≥ 20 / 5 |
| Also | 48 DQ rules, 12 controls, 20 agent instructions, 4 knockout answers, 7 value cases, 5 requests + 6 demand items | |

## Definition of Done

| Check | Result |
|---|---|
| Validator green for utilities | ✅ **3,805 checks, 0 errors, 0 warnings** (target ≥ 500) |
| Two builds → identical checksums | ✅ I08: identical per-table checksums on all 66 tables (scale S in the test; also verified by hand at scale M) |
| Build ≤ 25 s | ✅ **6.6 s** at scale M (66 tables, 1,663,711 rows); cached rebuild < 0.1 s |
| I01 (domain-string lint) | ✅ 126 pack terms, 0 violations in `src/`; a planted term fails the lint. It caught four leaks in my own schema comments during this phase, which I fixed. |
| typecheck / lint / unit + invariants / build / e2e + a11y | ✅ / ✅ / ✅ 94 passed, 33 todo (later invariants) / ✅ / ✅ 80 passed |

### Validator report (`pnpm pack:validate utilities`)

```
utilities: 3805 checks · 0 errors · 0 warnings
  1 Schema                         667 checks
  2 Referential                   2149 checks
  3 Quotas                          37 checks
  4 Warehouse                      665 checks   (objects built & non-empty, every semantic column exists,
                                                 base views return rows, all 48 DQ rules execute and pass)
  5 Semantics                      121 checks
  6 Governance                      82 checks
  9 Stories                         83 checks
  10 Domain-string lint input        1 check    (126 terms)
```
A unit test mutates a copy of the pack (bad enum, unknown term, unknown metric, broken fk, unknown product grant, unmasked PII on a certified product) and asserts each mutation produces its specific error.

### Sample Gold tables (scale M)

**CONFORMED_GOLD.DIM_FEEDER** (first 10 rows by key)

| feeder_key | feeder_id | substation_id | region | voltage_kv | customers_served | region_customers_served | vintage_band |
|---|---|---|---|---|---|---|---|
| 1 | F-2101 | SUB-09 | South | 12.47 | 8187 | 351480 | 2000+ |
| 2 | F-2102 | SUB-17 | East | 12.47 | 8827 | 323883 | Pre-1980 |
| 3 | F-2103 | SUB-02 | Central | 12.47 | 10114 | 296255 | 2000+ |
| 4 | F-2104 | SUB-14 | Central | 12.47 | 16498 | 296255 | 1980-1999 |
| 5 | F-2105 | SUB-11 | North | 12.47 | 15602 | 299609 | 1980-1999 |
| 6 | F-2106 | SUB-03 | South | 4.16 | 6998 | 351480 | 1980-1999 |
| 7 | F-2107 | SUB-15 | South | 12.47 | 16154 | 351480 | Pre-1980 |
| 8 | F-2108 | SUB-07 | East | 13.2 | 15332 | 323883 | 2000+ |
| 9 | F-2109 | SUB-17 | East | 12.47 | 6715 | 323883 | 1980-1999 |
| 10 | F-2110 | SUB-24 | East | 12.47 | 6587 | 323883 | Pre-1980 |

**CONFORMED_GOLD.FCT_OUTAGE** (first 10 rows by key)

| outage_id | feeder_key | date_key | duration_min | customers_affected | customer_minutes | cause | major_event_day |
|---|---|---|---|---|---|---|---|
| OUT-0000001 | 119 | 20260705 | 284 | 111 | 31524 | Equipment failure | false |
| OUT-0000002 | 75 | 20240402 | 51 | 120 | 6120 | Unknown | false |
| OUT-0000003 | 28 | 20240220 | 74 | 58 | 4292 | Tree contact | false |
| OUT-0000004 | 21 | 20260813 | 83 | 112 | 9296 | Unknown | false |
| OUT-0000005 | 67 | 20241211 | 421 | 68 | 28628 | Lightning | false |
| OUT-0000006 | 57 | 20260411 | 118 | 422 | 49796 | Animal | false |
| OUT-0000007 | 39 | 20250104 | 25 | 79 | 1975 | Lightning | false |
| OUT-0000008 | 103 | 20260321 | 45 | 80 | 3600 | Vehicle accident | false |
| OUT-0000009 | 75 | 20260916 | 184 | 90 | 16560 | Animal | false |
| OUT-0000010 | 8 | 20240709 | 38 | 42 | 1596 | Unknown | false |

**CONFORMED_GOLD.FCT_BILLING** (first 10 rows by key)

| statement_id | customer_key | statement_date | billed_amount | arrears_amount | estimated | mature | paid_within_60d_amount | days_to_pay |
|---|---|---|---|---|---|---|---|---|
| ST-000000001 | 5663 | 2026-09-28 | 169.4 | 0 | false | false | 0 | null |
| ST-000000002 | 13592 | 2026-06-24 | 122.61 | 0 | false | true | 122.61 | 10 |
| ST-000000003 | 16525 | 2025-11-24 | 91.64 | 0 | false | true | 91.64 | 34 |
| ST-000000004 | 456 | 2026-06-16 | 172.16 | 0 | false | true | 172.16 | 45 |
| ST-000000005 | 2180 | 2025-02-13 | 111.97 | 0 | false | true | 111.97 | 24 |
| ST-000000006 | 10544 | 2025-09-17 | 161.67 | 0 | false | true | 161.67 | 54 |
| ST-000000007 | 19624 | 2025-03-06 | 201.31 | 70.46 | false | true | 201.31 | 40 |
| ST-000000008 | 14220 | 2025-01-31 | 140.48 | 0 | false | true | 140.48 | 55 |
| ST-000000009 | 3394 | 2026-01-09 | 126.11 | 0 | false | true | 126.11 | 5 |
| ST-000000010 | 267 | 2026-03-31 | 143.59 | 0 | false | true | 143.59 | 27 |


Bronze → Silver cleaning on the outage feed: 15,546 Bronze rows (incl. 481 duplicate `U` rows, 65 `D` tombstones, 621 dirty cause codes) → 14,935 clean Silver rows.

### Calibration highlights (planted patterns the stories rely on)
- Q3 2026 SAIDI by region **excluding** major event days: East 58.8 (feeder F-2207 vegetation cluster) > South 36.9 > Central 32.6 > North 26.5 > West 17.6. **Including** MEDs, North leads (87.2), which is the rule-sensitive BR-UTL-012 moment.
- 2026 YTD: SAIDI 87.2 min, SAIFI 0.745, CAIDI 117.2 min; PM compliance, vegetation, billing, AMI and procurement KPIs sit inside their `kpis.yaml` bands (checked with SQL). The validator checks KPI ranges in category 7 from Phase 2/3 onwards, once the compiler exists.

## Deviations and decisions (please review)

1. **Schema additions beyond the 04 examples**: these are pack `code`, `heroAgent`, `lint_terms`, `warehouse/objects.yaml` (lineage), `key`/`loaded_at_from`, `scope_exprs` for slice-aware SAIDI/SAIFI denominators, empty time dimensions for snapshot views, policy `column_tags` with `mask_pending_fix`, `quality_fix` and others. All are listed in **ADR-0012**. Per PROMPT rule 8, changing them after this phase needs your approval.
2. **Relative time windows** ("last quarter" = last complete quarter ≤ asOf; `ytd`) are defined in **ADR-0011**; SQL uses `GOVERNANCE.as_of()`, never the wall clock.
3. **Regions**: I used the spec's five regions (North/South/East/West/Central) instead of AI-Ready's four operating companies, to match the 04 examples (East/F-2207 hero answer).
4. **No absolute customer-count KPIs.** The customer tables are a scaled sample (20k customers at scale M), while network denominators are full population (1.34M customers served). Absolute customer counts would look wrong to a client, so KPIs use rates and averages. The metrics `active_customers` and `bills_issued` are labelled "sample".
5. **Network tables are full population at every scale** (outages, feeders, PO lines), so reliability and spend KPIs are scale-independent; customer-side tables scale S/M/L.
6. **Customer email removed from the certified Customer 360 view.** It is masked only after the DP-UTL-005 certification fix (FIX-2), so exposing it on a certified product would break governance. The validator now enforces this.
7. **SC-UTL-013 (masked-data pattern)** now tests persona A, not B (B has no grant to Customer Insights). AG-UTL-001 is set to `pii_output: masked`; the customer-level refusal guardrail still applies to single-customer lookups.
8. **Metric SQL is not compiled or executed in Phase 1.** Category 4's "every metric compiles and returns a non-null value" needs `compileMetricQuery()` (Phase 2, invariant I03). Phase 1 checks every column the metric expressions reference.
9. **Content authored with parallel subagents** (glossary/rules/synonyms; verified queries/scenarios; docs/instructions/DQ/incidents/knockout/value/demand/stories), under my schema and validator; I reviewed and fixed their flagged conflicts.

## Open items carried to later phases
- **`qualityFixAgent` is not targeted by any of the six standard stories** (09 §2 has no Agent Quality step). The role is declared and validated; decide in Phase 7/9 whether S3 gets an Agent Quality step.
- **Knockout `gold_fallbacks.column_map` values include SQL expressions** (and some deliberately wrong stand-ins to produce "wrong" knockout answers). The Phase 8 compiler must accept expressions there.
- **Late-feed incident**: Gold facts carry no `_loaded_at`. The Phase 7 overlay should filter on the event timestamp or on Silver `loaded_at`; DQ-UTL-007 already detects the lag.
- **Prisma models**: none yet (Phase 2).
- **Fonts**: still waiting on your Phase 0 decision (offline font package vs vendored files).
- Banking, healthcare and retail packs are Phase 6.
