# Running Enterprise AI Ready - Data Products & Agents Exchange

## Prerequisites
- Node ≥ 22, pnpm 10 (`corepack enable`).
- About 1 GB of free disk for the four reference deep packs at scale M. Each deep pack takes about 55 MB.
- No network is needed in Scripted mode: fonts, icons and libraries are bundled.

## Quick start (presenter laptop)
```bash
pnpm install
cp .env.example .env            # set SESSION_SECRET; optionally ANTHROPIC_API_KEY for Live/Auto modes
pnpm demo                       # migrate → build warehouses (cached) → seed → build → start
open http://localhost:3000/launch
```
- `pnpm demo:fresh` forces a warehouse rebuild and a reseed.
- `pnpm doctor` runs pre-demo checks:
  - Node and disk;
  - app DB, packs and warehouses current for the pack content;
  - golden files present;
  - API key presence (never the value) and an optional live ping with `--ping`;
  - the clock.

  It ends with a **"Demo ready."** verdict.
- Probes: `/api/health` (process up) and `/api/ready` (DB, packs, warehouses; 503 if not ready).

## Everyday commands
| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server (http://localhost:3000) |
| `pnpm warehouse:build [--pack id] [--scale S\|M\|L] [--force]` | Builds `data/warehouse/<pack>.duckdb` (deterministic; cached by pack content hash) |
| `pnpm db:setup` | Migrates the app DB and seeds every pack through the real lifecycle |
| `pnpm pack:validate [id]` | The pack validator (schema, references, quotas, warehouse, semantics, governance, scenarios, agents, stories, lint input) |
| `pnpm golden [--pack id] [--update]` | Records or compares golden answers (scale M) |
| `pnpm knockout:deltas [--pack id] [--update]` | Computes Knockout single-layer deltas through the governed path, or checks them against `knockout.yaml` |
| `pnpm pack:draft --from utilities --id water --code WTR --company "…" --short ABC` | Pack Drafter, offline mode: a re-skinned **draft** pack (also available in Admin) |
| `pnpm snowflake:bundle --pack <id> [--out dir]` | Snowflake deploy bundle (ADR-0025): Parquet of every built object plus `deploy.sql` / `verify.sql`. Then `cd data/snowflake/<id> && snowsql -f deploy.sql && snowsql -f verify.sql`, and set `WAREHOUSE_ADAPTER=snowflake` |
| `pnpm lint` · `pnpm typecheck` | ESLint (boundaries, no-DuckDB-import, determinism) plus the domain-string lint; TypeScript |
| `pnpm test` | Unit, invariant, golden, integration, security and performance suites (Vitest) |
| `pnpm test:e2e` | Playwright. The `chromium` project (features and axe, light and dark) runs first, then `stories` (6 stories × deep packs), then `presenter` (launch and reset) |

## Configuration (`.env`)
| Variable | Default | Notes |
|---|---|---|
| `SESSION_SECRET` | — | Signs the persona and profile cookies. Production refuses the default |
| `DATABASE_URL` | `file:../data/keystone.db` | SQLite, relative to `prisma/`. The app uses one pooled connection (snapshot reset needs it) |
| `DATABASE_PROVIDER` | `sqlite` | `postgresql` for local runs: `pnpm db:pg:prepare && pnpm db:pg:push && pnpm db:seed` with a `postgresql://` URL. Snapshot reset is SQLite-only |
| `WAREHOUSE_DIR` / `DEMO_SCALE` | `./data/warehouse` / `M` | Where warehouses live, and their size (S ≈ 50K, M ≈ 500K, L ≈ 5M rows per pack) |
| `KEYSTONE_WAREHOUSE_AUTOBUILD` | unset | `1` builds a missing warehouse on first use (set in the container image) |
| `AGENT_MODE_DEFAULT` | `scripted` | `scripted`, `auto` (live, falling back visibly to scripted) or `live` |
| `WAREHOUSE_ADAPTER` | `duckdb` | `snowflake` runs governed queries on the pack's Snowflake database over the SQL API (key-pair auth: `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PRIVATE_KEY_PATH`, optional `SNOWFLAKE_WAREHOUSE` / `SNOWFLAKE_ROLE` / `SNOWFLAKE_HOST`). Experimental: mock-tested only; deploy the pack first with `pnpm snowflake:bundle` (ADR-0025) |
| `ANTHROPIC_API_KEY` | — | Read only by `src/lib/config/env.ts`. Never logged, persisted or sent to the browser |
| `KEYSTONE_MODEL_*` | see `.env.example` | Model IDs are configuration, never literals in code |
| `LLM_TIMEOUT_MS` · `LLM_MAX_TOOL_ROUNDS` · `LLM_BUDGET_USD_PER_SESSION` | 12000 · 6 · 5 | Live-mode limits |

## Docker
```bash
docker build -t keystone .                             # small image; warehouses build on first use per pack
docker build --build-arg PREBUILD=deep -t keystone .   # bake deep-pack warehouses (scale M) into the image
SESSION_SECRET=… docker compose up                     # http://localhost:3000, data in the keystone-data volume
```
- The image (278 MB) runs on distroless Node 22 as a non-root user, with no shell, and has a `HEALTHCHECK` on `/api/health`. Debug with `docker logs`; `docker exec sh` is not available.
- On first start, `/app/data` (the volume) is initialised from the image's seeded template: the app DB, plus warehouses if they were prebuilt.

## Data and reset
- `data/` holds the app DB, the per-pack warehouses (read-only at runtime) and `snapshots/`. It is never committed.
- Each Demo Profile has its own app DB (`data/keystone-profiles/<profileId>.db`), so several presenters can share one server without seeing each other's changes (ADR-0024). Saving a profile creates it and snapshots it. **Reset** in the presenter overlay restores that snapshot in place in well under 3 s and keeps the profile (ADR-0021).
- Re-seeding (`pnpm db:seed`) rebuilds every pack's demo state through the lifecycle. Answer records are append-only and are kept.

## Troubleshooting
| Symptom | Fix |
|---|---|
| A screen says a warehouse has not been built | `pnpm warehouse:build --pack <id>` (or set `KEYSTONE_WAREHOUSE_AUTOBUILD=1`) |
| `/api/ready` reports a stale warehouse | Pack content changed: `pnpm warehouse:build --pack <id>` |
| The app refuses to start in production | Set `SESSION_SECRET` |
| Live mode answers show a "Live→Scripted fallback" badge | No key, timeout or a grounding failure. The reason is on the badge; Scripted numbers are identical |
| A pack fails to load | `pnpm pack:validate <id>` lists the exact files and fields |
