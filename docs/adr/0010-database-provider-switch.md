# ADR-0010 — Database provider switching (SQLite default, Postgres optional)

- Status: Accepted (Phase 11)

## Context
CLAUDE.md §3 and `.env.example` specify `DATABASE_PROVIDER=sqlite | postgresql`. Prisma does not
allow the `datasource.provider` to be read from an environment variable.

## Decision
`prisma/schema.prisma` declares `sqlite`. Postgres support is delivered in Phase 11 by a small script
that renders the schema with `provider = "postgresql"` before `prisma generate` / `migrate` when
`DATABASE_PROVIDER=postgresql` (separate migration folders per provider). Models stay
provider-neutral until then (no SQLite-only or Postgres-only column types).

## Consequences
SQLite is the only tested provider until Phase 11; the Docker `postgres` compose profile depends on it.

## As built (Phase 11)
- `pnpm db:pg:prepare` renders `prisma/postgres/schema.prisma` (provider `postgresql`; generated and
  git-ignored), then generates the client for it. `pnpm db:pg:push` applies the schema with `prisma db push`
  rather than a second migration history. After that, `pnpm db:seed` seeds as usual. The rendered schema
  validates.
- Snapshot reset (ADR-0021) and the container's seeded template DB are SQLite-only. The image ships SQLite,
  and the compose `postgres` profile starts a Postgres 16 server for the local workflow above.
- Raw SQL in the app is limited to the SQLite reset (guarded) and the readiness `SELECT 1`.
- Not tested against a live Postgres in this environment (no server or Docker daemon available).
