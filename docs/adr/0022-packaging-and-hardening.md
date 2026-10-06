# ADR-0022: Packaging, readiness probes and hardening

Status: Accepted (Phase 11)

## Context
Phase 11 has three goals:
- ship Keystone as `pnpm demo` and as a container;
- give presenters a pre-flight check;
- harden the governed path (security fuzz, performance budgets, dark mode a11y).

Two things make packaging awkward:
- **Warehouse size.** Each deep pack's DuckDB warehouse takes about 55 MB at scale M, and there are 11 packs. Baking every warehouse into the image would make it bulky.
- **No Docker daemon.** The build environment can't build or run images, so image size and cold start can't be measured here.

## Decision
1. **Docker image**:
   - Multi-stage (`deps → build → runtime`), Next `output: 'standalone'`, `node:22-slim`.
   - Runs as a non-root user; `HEALTHCHECK` on `/api/health`.
   - `/app/data` is a volume. On first start it is initialised from a seeded template that ships in the image.
2. **Warehouses are optional in the image** (`ARG PREBUILD=none|deep`):
   - Default `none`: warehouses build on first use per pack (`KEYSTONE_WAREHOUSE_AUTOBUILD=1`). Generation is deterministic (I08), so the result is byte-identical to a prebuilt warehouse.
   - `deep` bakes the four reference deep packs (scale M) into the image, for offline presenter laptops.
3. **Probes**:
   - `/api/health` reports only that the process is up.
   - `/api/ready` reports the DB, packs, and each warehouse as present and current for its pack content hash. It returns 503 while not ready.
   - `pnpm doctor` runs the same checks plus Node/disk, golden files, API key presence (never the value) and an optional live ping, and ends with a "Demo ready." verdict.
4. **Postgres** is a local option only: `db:pg:prepare` derives `prisma/postgres/schema.prisma`, then `db:pg:push`. The image and snapshot reset stay SQLite (ADR-0021).
5. **Hardening**:
   - `sql-safety` refuses `SUMMARIZE`, `DESCRIBE` and `SHOW`, on top of the DDL/DML/file-function deny list.
   - A 200-payload fuzz suite runs against every QueryService entry point.
   - Performance budgets are Vitest tests with generous thresholds (CI noise).
   - Dark mode follows the OS before first paint (no stored preference). Dark tokens pass the axe sweep.
6. **CI** adds golden and eval checks, knockout deltas, stories (Playwright `stories` project), and a Docker build with a health smoke test that also reports image size.
7. **Snowflake adapter** (stretch) is deferred. `WarehouseAdapter` is the seam; no v1 screen depends on it.

## Consequences
- The default image is small. The first question on a cold pack waits for its warehouse to build (seconds at scale M); `pnpm doctor`/`/api/ready` show this.
- Image size and cold start are verified in CI (the docker job), not in the authoring environment.
