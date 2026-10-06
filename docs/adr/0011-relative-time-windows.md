# ADR-0011 — Relative time windows are anchored to the pack clock

- Status: Accepted (Phase 1)

## Context
KPI windows, verified queries and scenarios say "last quarter", "last month", "year to date". The
spec requires every engine to read "now" from `pack.asOf` (invariant I08) but does not define how a
relative window resolves.

## Decision
- `last: { n, unit }` = the `n` most recent **complete** calendar units ending on or before `asOf`.
  If `asOf` is the last day of a unit, that unit counts as complete (utilities: asOf 2026-09-30 ⇒
  "last quarter" = Q3 2026, "last month" = September 2026).
- `ytd: true` = 1 January of `asOf`'s year through `asOf`.
- `from`/`to` are inclusive ISO dates.
- SQL never reads the wall clock: the build creates `GOVERNANCE.as_of()` returning `asOf`; Silver/Gold
  SQL use it for "overdue"/"mature" flags.

## Consequences
The same question returns the same number on any day the demo is run. The metric compiler (Phase 2)
implements this resolution; the validator and golden files depend on it.
