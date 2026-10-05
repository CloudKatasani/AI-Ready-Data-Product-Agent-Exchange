# Phase 0 — Scaffold & contract

Status: **complete, awaiting "continue"**. Date: 2026-10-05.

## Built

| Deliverable | Where |
|---|---|
| Spec pack copied into repo (binding contract, spec, kickoff prompt, rubrics) | `CLAUDE.md`, `docs/build-spec/`, `docs/PROMPT.md`, `packs/_shared/rubrics.yaml` |
| Stack per CLAUDE.md §3: Next.js 15.5 (App Router, `output: 'standalone'`), React 19, TS 5.9 `strict` (+ `noUncheckedIndexedAccess`), Tailwind 4, shadcn/ui conventions (`components.json`, Radix, cva), lucide-react, Zod 4, Prisma 6 (SQLite), Vitest, Playwright + axe, pnpm 10, Node 22 | `package.json`, `tsconfig.json`, `next.config.ts`, `components.json` |
| ESLint: next + TS rules, `no-explicit-any`, `max-lines` 600, **module boundaries** per 02 §3 (`eslint-plugin-boundaries`), **DuckDB import ban** outside `src/lib/warehouse/duckdb.ts` (I02), **determinism** ban on `Math.random`/`Date.now`/`new Date()` in engine dirs (I08), **no default exports** outside Next convention files, services never import React/UI | `eslint.config.mjs` |
| Domain-string lint (I01): scanner + CLI; term extraction plugs in with the pack schema in Phase 1 | `scripts/lint/no-domain-strings.ts` |
| AppShell: top bar (brand from `brand.productName`, pack switcher, search, ⌘K hint, mode badge from `AGENT_MODE_DEFAULT`, persona switcher stub, presenter ⋯ menu), collapsible door nav with active-route highlight, skip link, synthetic-data footer | `src/components/shell/*` |
| Stub page for **every route in 01 §3** (29 routes + `/launch`), each naming its module, spec section and delivery phase | `src/app/[pack]/(consumer|builder|operator|strategist|presenter)/…`, `src/app/(presenter)/launch` |
| Generic UI copy | `src/copy/en.ts` |
| White-label tokens + WCAG contrast guard with neutral fallback (basis for AC1.2) | `src/lib/presenter/branding.ts`, `src/app/globals.css` |
| Typed env config (02 §6) + startup refusal of default `SESSION_SECRET` in production | `src/lib/config/env.ts`, `src/instrumentation.ts`, `.env.example` |
| `/api/health` | `src/app/api/health/route.ts` |
| Invariant placeholders I01–I11 (`it.todo`, each naming its assertions) | `tests/invariants/` |
| CI: install → typecheck + lint → unit + invariants → build, plus e2e + a11y job | `.github/workflows/ci.yml` |
| ADR-0001…0008 from 02 §2, plus ADR-0009 and ADR-0010 (below) | `docs/adr/` |
| Running guide | `docs/RUNNING.md` |

## Definition of Done

| Check | Result |
|---|---|
| `pnpm dev` shows shell | ✅ `/sample/home` → 200 with shell |
| `pnpm test` runs | ✅ 5 files, **63 passed**, 37 todo (I01–I11 placeholders) |
| `pnpm typecheck` | ✅ clean |
| `pnpm lint` (`--max-warnings=0`) | ✅ clean; no-domain-strings: 0 packs, 0 violations. Rules verified to fire on planted violations (boundary, DuckDB import, `Math.random`, React in lib, default export) |
| `pnpm build` | ✅ |
| `pnpm test:e2e` (e2e + axe WCAG 2.2 AA, every scaffold URL) | ✅ **80 passed**, zero serious/critical axe findings |
| CI green | ⏳ workflow committed; first run happens on the GitHub push/PR — not yet observed |
| ADRs present | ✅ 0001–0010 |

## Deviations and decisions (please review)

1. **Conflict flagged — default exports.** CLAUDE.md §8 says "no default exports except Next pages",
   but Next also requires default exports from `layout`, `not-found`, `error`, … and tool configs.
   Interpreted as "Next.js convention files"; lint-enforced. → **ADR-0009**.
2. **Conflict flagged — `DATABASE_PROVIDER`.** Prisma cannot read the datasource provider from env.
   Schema is SQLite now; Postgres via a schema-render step in Phase 11. → **ADR-0010 (Proposed)**.
3. **Route groups inside `[pack]`.** Groups live at `src/app/[pack]/(consumer)/…` so one shared
   `[pack]/layout.tsx` holds the shell (no remount when crossing doors). URLs are exactly as in 01 §3.
   Optional segments (`[agentId?]`, `[schema?]/[object?]`, …) are optional catch-alls that 404 on extra segments.
4. **Placeholder pack id.** Until the registry exists, `[pack]` accepts any lowercase id and the
   launcher links to `/sample/home`. Phase 1 replaces this with a registry lookup.
5. **Fonts.** Inter / JetBrains Mono are referenced but not bundled yet (system fallback). Bundling
   offline needs either a new dependency (e.g. `@fontsource-variable/inter`) or vendored `.woff2`
   files — **needs your choice** (PROMPT rule 8).
6. **Dependencies deferred, not dropped.** DuckDB, Anthropic SDK, Recharts, @xyflow, Mermaid, cmdk and
   MiniSearch are in §3 but are added in the phase that first uses them, to keep Phase 0 lean.
7. **Playwright pinned to 1.56.x** to match the Chromium build pre-installed in this environment;
   CI installs its own browser. Can be bumped freely.
8. **CI scope.** Steps 1–3 and 7 as specified, plus an e2e + a11y job (cheap now, required from Phase 4).
9. **Theme.** Light by default; dark tokens defined. The projector/dark toggle lands with the presenter overlay (Phase 9).

## Blocker for Phase 1

The three predecessor repos are expected as read-only siblings in `../reference/`. This session only
has GitHub access to this repository, so they are **not cloned yet**. Phase 1 (utilities pack
conversion) needs them — please confirm they can be added to the session (or are public).

## Screenshots

- Launcher: `img/phase-0-launch.png`
- Shell (Home): `img/phase-0-shell-home.png`
- Shell (Explorer with optional segments): `img/phase-0-shell-explorer.png`
