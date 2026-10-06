# ADR-0012 — Pack schema additions beyond the 04 examples

- Status: Accepted (Phase 1). Changing these after Phase 1 needs owner approval (PROMPT rule 8).

The 04 spec shows schemas by example. Building the utilities pack needed these additions:

| Addition | Where | Why |
|---|---|---|
| `code` (e.g. `UTL`) | pack.yaml | Id segment for `DP-UTL-001` etc.; `company.short` (NVE) differs from the id code |
| `industry`, `lint_terms` | pack.yaml | Feed the domain-string lint (invariant I01) with words that are not object names |
| `home.heroAgent` | pack.yaml | Deterministic target for the hero question until the Router exists |
| `warehouse/objects.yaml` | new file | Silver/Gold metadata (kind, target lag, upstream edges, grain) for Explorer, lineage and the validator — parsing SQL for lineage is brittle |
| `key`, `loaded_at_from` | sources.yaml tables | Natural key for CDC duplicates/tombstones and Silver dedup; event column that drives `_loaded_at` |
| `date_offset`, `const`, `fk.dist: sequential` | generator vocabulary | Dates relative to another column (due dates, payment dates), constants, one-child-per-parent links (payments) |
| `dirty`, `null_pct` | source columns | Per-column control over CDC dirty strings and nulls |
| `scope_exprs` | semantic metrics | Slice-aware ratio denominators (SAIDI/SAIFI by feeder/substation/region divide by customers served *in that scope*); the compiler picks the first entry whose dimension is grouped, filtered or row-filtered |
| `time_dimensions` may be empty | semantic views | Snapshot views (asset condition, customer master) have no time axis |
| `column_tags` with `cde`, `masking`, `mask_pending_fix` | policies.yaml | Silver/Gold classifications live with policies (Bronze tags stay on source columns); the gate-6 story needs masking that is not yet attached |
| `kind`, `status: pending_fix` | rules.yaml, verified_queries.yaml | Rule classification; verified queries activated by the certification fix |
| `quality_fix` | agent manifest | The Agent Quality story's scripted fix and declared eval delta |
| `aggregates_only`, `sees` | personas.yaml | Executive archetype and the persona-switcher one-liner |
| Metric names unique per pack | validator | Rules and KPIs reference metrics by bare name (as in the 04 examples) |
