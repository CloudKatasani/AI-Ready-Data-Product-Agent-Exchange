# Phase 11 — Hardening & packaging

Status: **complete**. The one exception is the Snowflake adapter (stretch), which is deferred.

CI is green on `main`: all three jobs (checks, E2E/a11y/stories, Docker image) passed in [run #3](https://github.com/CloudKatasani/AI-Ready-Data-Product-Agent-Exchange/actions/runs/37485374484) at commit `7f901df`.

Date: 2026-10-06. This is the final phase of the build plan.

## Built

| Deliverable | Where |
|---|---|
| **Readiness**:<br>• `/api/health` (process up).<br>• `/api/ready` (app DB, packs, each warehouse present and current for its content hash; 503 until ready).<br>• `pnpm doctor`: Node/disk, DB, packs, warehouses, golden files, API key presence only, optional `--ping`, clock; ends "Demo ready." | `src/lib/presenter/readiness-check.ts`, `src/app/api/ready`, `scripts/doctor.ts` |
| **Packaging**:<br>• Multi-stage Dockerfile: `node:22-slim` build stages; runtime on distroless Node 22 (non-root, no shell), with a `HEALTHCHECK`.<br>• `/app/data` volume initialised on first start from a gzipped seeded template, by the Node entrypoint.<br>• `PREBUILD=none\|deep`; opt-in warehouse autobuild on first use.<br>• Compose file with optional Postgres.<br>• Postgres local workflow (`db:pg:prepare`/`db:pg:push`).<br>• `sharp` excluded (no `next/image`). | `Dockerfile`, `docker/entrypoint.mjs`, `docker-compose.yml`, `next.config.ts`, `scripts/db-provider.ts`, ADR-0022 |
| **Security**:<br>• 200-payload SQL fuzz against the worksheet SQL path (every payload rejected). `SUMMARIZE`/`DESCRIBE`/`SHOW` are refused alongside DDL/DML/file functions.<br>• Session and secret tests: only intact cookie signatures are accepted; no API-key-shaped literal is committed. I11 covers key handling. | `tests/security/*`, `src/lib/query/sql-safety.ts` |
| **Performance budgets** as tests: scripted golden answers (p95 and max), metric compilation. Reset is budgeted by I09 | `tests/perf/budgets.test.ts` |
| **Accessibility**:<br>• Dark mode follows the OS before first paint.<br>• Dark tokens pass the axe sweep (75/75 routes), alongside the light sweep. | `src/app/layout.tsx`, `src/app/globals.css`, `tests/a11y/routes-dark.spec.ts` |
| **Docs**:<br>• `docs/RUNNING.md`: install, `.env`, demo, doctor, Docker, Postgres, tests, troubleshooting.<br>• `docs/PRESENTER.md`: profile setup, overlay and shortcuts, six stories, break/fix, reset, FAQ. | `docs/` |
| **CI**:<br>• Typecheck, lint, tests with the coverage threshold, `pack:validate`, golden, knockout deltas, build.<br>• E2E (features, axe, stories, presenter).<br>• Docker build with a smoke test (health, plus a pack page that builds its warehouse on first use). It prints container logs on failure and fails if the image exceeds 300 MB. | `.github/workflows/ci.yml` |
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
| Cold start to ready < 20 s with prebuilt warehouses | ✅ Two measurements:<br>• **Standalone server, prebuilt warehouses:** 4.1 s from start to `/api/ready` 200 with all 11 warehouses current.<br>• **Container in CI, without prebuilt warehouses:** **8.7 s** from `docker run` to `/api/health` OK and a rendered `/utilities/home`. That includes unpacking the template DB and building the utilities warehouse on first use. |
| Image < 300 MB | ✅ **278 MB** (CI, uncompressed). The first CI run measured 371 MB on a `node:22-slim` runtime. Three changes brought it under budget (ADR-0022, amended):<br>• distroless Node 22 runtime;<br>• template DB gzipped (34 → 9 MB);<br>• duplicate `packs/` copy dropped.<br>CI now enforces the budget. |
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
