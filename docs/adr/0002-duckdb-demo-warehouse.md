# ADR-0002 — DuckDB as the demo warehouse

- Status: Accepted (Phase 0; implemented Phase 1)
- Source: `02-architecture.md` §2

## Context
AI-Ready generated rows in the browser behind a `MockSnowflake` facade; the marketplace used Postgres.
Neither ran the same SQL that a client would see, so numbers could drift between surfaces.

## Decision
Use DuckDB (`@duckdb/node-api`) in-process, one file per pack at `data/warehouse/<pack>.duckdb`, with
Snowflake-style schema names (Bronze → Governance). Only `src/lib/warehouse/duckdb.ts` may import the
driver (invariant I02, lint-enforced). A Snowflake adapter behind the same `WarehouseAdapter`
interface is a Phase 11 stretch.

## Consequences
- Real SQL executes; file snapshots make reset instant (ADR-0007).
- SQL shown to users is rendered in Snowflake dialect by a display translator (05 §4).
- DuckDB is opened with `enable_external_access=false` and `lock_configuration=true`.
