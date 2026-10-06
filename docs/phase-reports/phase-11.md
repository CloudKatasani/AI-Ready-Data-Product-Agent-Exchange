# Phase 11 — Hardening & packaging

Status: **complete**, with three exceptions:
- Container image size and container cold start can't be measured here (there's no Docker daemon); see below.
- The Snowflake adapter (stretch) is deferred.
- Nothing has run in CI yet: the workflow is wired, but no push to `main` or PR has triggered it.

Date: 2026-10-06. This is the final phase of the build plan.

## Built

| Deliverable | Where |
|---|---|
| **Readiness**:<br>• `/api/health` (process up).<br>• `/api/ready` (app DB, packs, each warehouse present and current for its content hash; 503 until ready).<br>• `pnpm doctor`: Node/disk, DB, packs, warehouses, golden files, API key presence only, optional `--ping`, clock; ends "Demo ready." | `src/lib/presenter/readiness-check.ts`, `src/app/api/ready`, `scripts/doctor.ts` |
| **Packaging**:<br>• Multi-stage Dockerfile: standalone Next, `node:22-slim`, non-root, `HEALTHCHECK`.<br>• `/app/data` volume initialised from a seeded template.<br>• `PREBUILD=none\|deep`; opt-in warehouse autobuild on first use.<br>• Compose file with optional Postgres.<br>• Postgres local workflow (`db:pg:prepare`/`db:pg:push`).<br>• `sharp` excluded (no `next/image`). | `Dockerfile`, `docker/entrypoint.sh`, `docker-compose.yml`, `next.config.ts`, `scripts/db-provider.ts`, ADR-0022 |
| **Security**:<br>• 200-payload SQL fuzz against the worksheet SQL path (every payload rejected). `SUMMARIZE`/`DESCRIBE`/`SHOW` are refused alongside DDL/DML/file functions.<br>• Session and secret tests: only intact cookie signatures are accepted; no API-key-shaped literal is committed. I11 covers key handling. | `tests/security/*`, `src/lib/query/sql-safety.ts` |
| **Performance budgets** as tests: scripted golden answers (p95 and max), metric compilation. Reset is budgeted by I09 | `tests/perf/budgets.test.ts` |
| **Accessibility**:<br>• Dark mode follows the OS before first paint.<br>• Dark tokens pass the axe sweep (75/75 routes), alongside the light sweep. | `src/app/layout.tsx`, `src/app/globals.css`, `tests/a11y/routes-dark.spec.ts` |
| **Docs**:<br>• `docs/RUNNING.md`: install, `.env`, demo, doctor, Docker, Postgres, tests, troubleshooting.<br>• `docs/PRESENTER.md`: profile setup, overlay and shortcuts, six stories, break/fix, reset, FAQ. | `docs/` |
| **CI**:<br>• Typecheck, lint, tests with the coverage threshold, `pack:validate`, golden, knockout deltas, build.<br>• E2E (features, axe, stories, presenter).<br>• Docker build with a health smoke test and image-size report. | `.github/workflows/ci.yml` |
| **Coverage**:<br>• A surface test: fresh-DB lifecycle seed; validator categories 4/7/8; ODCS, OpenLineage, semantic-view YAML and DDL; evidence pack and audit bundle; Studio and Autopilot; demand; coverage heatmap; readiness probe.<br>• `thresholds: { lines: 85, statements: 85 }` | `tests/integration/surface.test.ts`, `vitest.config.ts` |

## Definition of Done

| Check | Result |
|---|---|
| `10` §1 targets: reset < 3 s | ✅ about 90 ms (I09) |
| `10` §1 targets: a11y | ✅ axe WCAG 2.2 AA, light and dark |
| `10` §1 targets: determinism | ✅ I08 |
| `10` §1 targets: synthetic only | ✅ I10 |
| `10` §1 targets: secrets | ✅ I11 |
| `10` §1 targets: perf budgets | ✅ perf suite |
| Coverage ≥ 85% of `src/lib` | ✅ **91.1% lines**, 87.1% statements, 87.5% functions, 71.1% branches (540 tests) |
| Cold start to ready < 20 s with prebuilt warehouses | ✅ measured on the standalone production server (outside a container): **4.1 s** from `next start` to `/api/ready` 200 with all 11 warehouses current; first `/utilities/home` render 0.5 s later. ⚠️ Not measured inside a container. |
| Image < 300 MB | ⚠️ Not measurable here: no Docker daemon. The standalone server is **139 MB**, of which DuckDB's native binding is 68 MB. On `node:22-slim` the uncompressed image will likely land a little above 300 MB, and well under it compressed. The CI docker job prints the real size. If it is over budget, the next step is an Alpine/musl runtime or slimming the DuckDB binding. |
| Snowflake adapter | ⏸ Deferred (stretch). `WarehouseAdapter` is the seam; no v1 screen depends on it (ADR-0022) |

Totals at the end of Phase 11:
- `pnpm test`: 42 files, **540 passing**.
- `pnpm test:e2e`: **321 passing**.
- Lint, typecheck and build are clean.
- All 11 packs: validator, golden and knockout green.

## Notes
- **ADR-0022:** packaging, probes, hardening.
- **ADR-0023:** standard-pack rules and pack-authoring guard rails.
- **Deferred:** profile-scoped runtime models (several presenters sharing one server; ADR-0021); Snowflake adapter.
