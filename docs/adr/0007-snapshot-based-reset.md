# ADR-0007 — Snapshot-based reset

- Status: Accepted (Phase 0; implemented Phase 9)
- Source: `02-architecture.md` §2 and §5.4

## Decision
A Demo Profile's start state is a copy of the pristine SQLite app DB and DuckDB warehouse files in
`data/snapshots/<profileId>/`. Reset closes connections, copies files back, reopens and bumps
`demoEpoch` so clients refetch. Postgres mode uses `TRUNCATE` + `COPY FROM` (target < 8 s).

## Consequences
- `resetDemo()` completes in < 3 s (invariant I09) — copy, never re-seed.
