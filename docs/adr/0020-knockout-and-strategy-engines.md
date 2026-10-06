# ADR-0020 — Knockout through the real query path; evidence-based maturity

Status: Accepted (Phase 8)

## Context
Knockout must show four governed answers degrading as layers are switched off (05 §1.7). AC11.1 requires
the flagged KPI to move by its pack-declared delta, and every pack's `declared_delta_pct` was left empty
"to be verified against the warehouse in Phase 8". 01 §M11 also asks for a six-dimension maturity score
on the Portfolio screen.

## Decision
1. **Knockout recomputes; nothing is scripted.** `QueryRequest.metric.knockout` is honoured only for the
   `knockout` purpose.
   - **Compiler**: `semantic` off uses `naive_expr` and no rules; `context` off drops the rules;
     `glossary` off leaves the compiler unchanged (its failure is ambiguity in matching).
   - **QueryService** handles the other three layers:
     - `gold` off: each Gold object becomes a Gold-shaped projection over its declared Silver fallback (`column_map`).
     - `silver` off: the source becomes its raw Bronze upstream, with CDC duplicates.
     - `governance` off: row access and masking are skipped; entitlement still applies.
   - Each switched-off layer is recorded as a `knockout` policy in the QueryLog.
   - Failure types and confidence come from the pack's `failure_by_layer`.
2. **Declared deltas are generated, then enforced.** `pnpm knockout:deltas --update` computes every
   answer's single-layer delta at scale M and writes it into `knockout.yaml`. Tests then require
   computed = declared (±0.1).
   - When raw Bronze lacks a column that Silver derives (for example a date column cast from a
     timestamp), the "Silver off" answer is reported as *not computable*.
   - That is the story, so no delta is declared for it. The test also asserts that it stays
     non-computable.
3. **Readiness, roadmap and RACI are ported verbatim.**
   - The readiness question bank, presets, scoring and gap ranking are unchanged. The `aiops`
     dimension is renamed `ai_ops` to match the rubric. Weights, bands and target come from the rubric
     (the same values).
   - AC11.2 fixtures were computed by running the predecessor engine itself.
   - Roadmap proof routes and RACI activity links now point at Keystone screens.
4. **Maturity is derived from evidence.** ADPM's six dimensions, levels and next moves are kept. Each
   level is `1 + round(share × 4)` of a measurable share of the live estate:
   - consumption: products naming a decision and ≥ 3 questions;
   - lifecycle: products whose passed stages all have approved gates;
   - semantic: KPIs with a semantic metric and a verified query;
   - governance: certified products whose checks all pass;
   - automation: human-accepted agent proposals;
   - operating: value cases measured.
5. **Portfolio scoring** uses ADPM's WSJF-with-reuse and RICE.
   - Inputs are derived from the pack (consumers, cadence, sensitivity, upstream size, conformed
     dimensions, metric reuse). The illustrative sizing constants are shown on screen.
   - Overrides need a reason, are append-only rows and are audited.

## Consequences
- Changing a pack's SQL or semantics can move the knockout deltas. The test fails until
  `pnpm knockout:deltas --update` is re-run and the diff is reviewed, just like golden answers.
- The predecessor's Build Guide (a step-by-step Snowflake build manual) is not part of Keystone's M11
  screens and is not ported.
