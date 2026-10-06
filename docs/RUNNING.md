# Running Keystone

Status: **Phase 2 — governed query path & knowledge screens.** Explorer, Semantic (with Playground),
Glossary and Context are live for the utilities pack, all reading through QueryService with persona
policies. Other modules are still stubs (see `docs/build-spec/11-build-plan.md`).

## Prerequisites

- Node ≥ 22 (`.nvmrc`), pnpm 10 (`corepack enable` picks the version from `package.json`).
- No network or API key is needed to run the demo in Scripted mode.

## First run

```bash
pnpm install                # also runs prisma generate
cp .env.example .env        # optional in development; defaults match .env.example
pnpm db:setup               # SQLite app DB at data/keystone.db: migrate + seed personas/entitlements
pnpm warehouse:build        # DuckDB warehouse(s) at data/warehouse/ (≈ 6 s, cached)
pnpm dev                    # http://localhost:3000 → /launch → pick a pack
```

Or in one go (production build): `pnpm demo`.

Switch persona from the top bar (or `Ctrl+Shift+P`); every screen re-renders with that identity's
entitlements, masking and row filters. The persona is a signed, httpOnly cookie.

Build the demo warehouse once (≈ 6 s for the utilities pack at scale M, then cached):

```bash
pnpm warehouse:build --pack utilities
pnpm pack:validate utilities
```


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
| `pnpm test` | Vitest: unit, invariants (I01–I03, I08, I11 implemented), integration (builds a scale-S warehouse in `data/test-warehouse/` on first run) |
| `pnpm test:e2e` | Playwright e2e + axe a11y against `pnpm start` on :3100 (run `pnpm build` first; the web server step builds the warehouse and seeds the DB) |
| `pnpm check` | typecheck + lint + unit tests |
| `pnpm db:generate` | `prisma generate` |
| `pnpm db:setup` | `prisma migrate deploy` + seed (personas, entitlements, audit event) for every pack |
| `pnpm demo` | db:setup → warehouse:build → build → start |
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
