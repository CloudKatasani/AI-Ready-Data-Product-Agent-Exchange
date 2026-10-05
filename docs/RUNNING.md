# Running Keystone

Status: **Phase 0 — scaffold.** The shell, navigation and every route exist as stubs. Packs, the
warehouse, personas and agents arrive from Phase 1 onwards (see `docs/build-spec/11-build-plan.md`).

## Prerequisites

- Node ≥ 22 (`.nvmrc`), pnpm 10 (`corepack enable` picks the version from `package.json`).
- No network or API key is needed to run the demo in Scripted mode.

## First run

```bash
pnpm install
cp .env.example .env        # optional in development; defaults match .env.example
pnpm dev                    # http://localhost:3000 → redirects to /launch
```

Until packs are installed (Phase 1) the launcher offers "Open the empty shell", which browses the
scaffold under the placeholder pack id `sample`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server on :3000 |
| `pnpm build` / `pnpm start` | Production build (`output: 'standalone'`) / serve it. Production refuses the default `SESSION_SECRET`. |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | ESLint (module boundaries, DuckDB-import ban, determinism, no default exports) + `scripts/lint/no-domain-strings.ts` |
| `pnpm test` | Vitest: `tests/unit`, `tests/invariants` (I01–I11; `todo` until their phase), `tests/golden` |
| `pnpm test:e2e` | Playwright e2e + axe a11y against `pnpm start` on :3100 (run `pnpm build` first) |
| `pnpm check` | typecheck + lint + unit tests |
| `pnpm db:generate` | `prisma generate` (no models until Phase 2) |

Playwright uses Chromium; in environments with a pre-installed browser set `PLAYWRIGHT_BROWSERS_PATH`
instead of running `playwright install`.

## Configuration

All settings are environment variables documented in `.env.example` (02-architecture §6).
`ANTHROPIC_API_KEY` is read from the environment only and never reaches the browser, logs or DB.

## Health

- `GET /api/health` → `{ "status": "ok" }` (process up).
- `GET /api/ready` arrives with packs and the warehouse.

## Planned (later phases)

`pnpm demo`, `pnpm demo:fresh`, `pnpm warehouse:build`, `pnpm pack:validate`, `pnpm golden`,
`pnpm eval`, `pnpm doctor`, Docker image and compose — see `docs/build-spec/12-deployment.md`.
