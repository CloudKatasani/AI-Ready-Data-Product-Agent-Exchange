# 12 — Packaging, Deployment & Operations

## 1. Local (presenter laptop)

```bash
pnpm install
cp .env.example .env            # optionally add ANTHROPIC_API_KEY
pnpm demo                       # = prisma migrate deploy → warehouse:build (cached) → seed → snapshot → next start
open http://localhost:3000/launch
```
- `pnpm demo:fresh` forces warehouse rebuild + reseed.
- Works fully offline in Scripted mode (fonts, icons, libs bundled; no CDN).
- Disk: ~150 MB per deep pack at scale M.

## 2. Docker

- Multi-stage: deps → build (Next `output: 'standalone'`) → warehouse prebuild for deep packs at scale M
  → runtime (node:22-slim, non-root, `HEALTHCHECK` on `/api/health`).
- Volumes: `/app/data` (app DB, warehouses, snapshots, uploaded logos).
- `docker compose up` profiles: `default` (SQLite), `postgres` (adds Postgres 16 + `DATABASE_PROVIDER=postgresql`).

## 3. Shared demo server (optional)

Container platforms (AWS App Runner/ECS Fargate, Azure Container Apps, GCP Cloud Run with min-instances 1
because of local files — or a persistent volume). Put behind corporate SSO proxy / IP allow-list;
`AUTH_MODE=proxy` (stretch) trusts `X-Forwarded-User` for presenter identity and isolates Demo Profiles
per presenter. Secrets via platform secret store → env. One instance per 3–5 concurrent presenters
(DuckDB is per-process; warehouses are read-mostly, incident overlays are per-profile schemas).

## 4. Concurrency model

Each Demo Profile gets its own app-state rows (profile-scoped `packId` + `profileId` columns on mutable
tables — add `profileId` to all runtime models in Phase 9) and its own incident overlay schema
(`_INCIDENT_<profileId>`), so two presenters on one server don't collide. Base warehouse files are
shared read-only.

## 5. Operations

- `/api/health` (process up), `/api/ready` (DB + warehouse open + packs validated).
- Structured logs (pino) with request id, persona, profile; never log prompts with sensitive values or API keys.
- `pnpm doctor` — checks Node version, disk, warehouse checksums vs golden, API key presence and a
  1-token live ping (optional), clock sanity; prints a "demo ready" verdict.

## 6. Snowflake adapter (Phase 11, stretch)

`SnowflakeAdapter` implements `WarehouseAdapter` using the Snowflake SQL API (key-pair auth). Deploy
script `pnpm snowflake:deploy --pack utilities` renders the pack into real Snowflake DDL (database,
9 schemas, tables loaded via `PUT`/`COPY` of generated Parquet, dynamic tables for Silver/Gold, tags,
masking & row access policies, semantic view from YAML, Cortex Search service on context docs).
Compiler emits Snowflake dialect when this adapter is active. Golden agreement test must pass against
Snowflake before a pack is marked "Snowflake-verified". Cortex Agents integration is out of scope for v1;
the live engine remains Anthropic tool-use over the governed path.
