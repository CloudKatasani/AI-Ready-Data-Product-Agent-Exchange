# Running Keystone

Status: **Phase 1 — packs & warehouse.** The utilities pack loads, validates and builds a DuckDB
warehouse. Screens are still Phase 0 stubs; governed queries and personas arrive in Phase 2
(see `docs/build-spec/11-build-plan.md`).

## Prerequisites

- Node ≥ 22 (`.nvmrc`), pnpm 10 (`corepack enable` picks the version from `package.json`).
- No network or API key is needed to run the demo in Scripted mode.

## First run

```bash
pnpm install
cp .env.example .env        # optional in development; defaults match .env.example
pnpm dev                    # http://localhost:3000 → redirects to /launch
```

Build the demo warehouse once (≈ 6 s for the utilities pack at scale M, then cached):

```bash
pnpm warehouse:build --pack utilities
pnpm pack:validate utilities
```

The launcher still offers "Open the empty shell" (placeholder pack id `sample`) until Phase 2 wires
screens to packs.

### Editing a pack

Pack files are YAML/SQL/Markdown under `packs/<id>/`. Point your editor's YAML schema mapping at
`packs/_schema/*.schema.json`. After changes run `pnpm pack:validate <id>`; the warehouse rebuilds
automatically when any pack file changes.

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
| `pnpm warehouse:build [--pack id] [--scale S\|M\|L] [--force]` | Builds `data/warehouse/<pack>.duckdb` (cached by pack content hash; `--force` rebuilds) |
| `pnpm pack:validate [id] [--static] [--json]` | Validator categories 1–6, 9, 10; builds the warehouse at scale M if needed; report in `data/reports/<pack>-validation.json` |
| `pnpm pack:schema` | Regenerates JSON Schema for pack files into `packs/_schema/` (editor autocompletion) |

Playwright uses Chromium; in environments with a pre-installed browser set `PLAYWRIGHT_BROWSERS_PATH`
instead of running `playwright install`.

## Configuration

All settings are environment variables documented in `.env.example` (02-architecture §6).
`ANTHROPIC_API_KEY` is read from the environment only and never reaches the browser, logs or DB.

## Health

- `GET /api/health` → `{ "status": "ok" }` (process up).
- `GET /api/ready` arrives with packs and the warehouse.

## Planned (later phases)

`pnpm demo`, `pnpm demo:fresh`, `pnpm golden`,
`pnpm eval`, `pnpm doctor`, Docker image and compose — see `docs/build-spec/12-deployment.md`.
