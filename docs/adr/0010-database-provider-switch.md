# ADR-0010 — Database provider switching (SQLite default, Postgres optional)

- Status: Proposed (Phase 0); to be finalised in Phase 11

## Context
CLAUDE.md §3 and `.env.example` specify `DATABASE_PROVIDER=sqlite | postgresql`. Prisma does not
allow the `datasource.provider` to be read from an environment variable.

## Decision (proposed)
`prisma/schema.prisma` declares `sqlite`. Postgres support is delivered in Phase 11 by a small script
that renders the schema with `provider = "postgresql"` before `prisma generate` / `migrate` when
`DATABASE_PROVIDER=postgresql` (separate migration folders per provider). Models stay
provider-neutral until then (no SQLite-only or Postgres-only column types).

## Consequences
SQLite is the only tested provider until Phase 11; the Docker `postgres` compose profile depends on it.
