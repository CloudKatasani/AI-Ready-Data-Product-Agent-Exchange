# 10 — Testing & Quality Gates

## 1. Test pyramid

| Layer | Tool | Scope | Target |
|---|---|---|---|
| Unit | Vitest | engines: compiler, policies, sql-safety, matcher, planner, grounding, gate engine, cascade, readiness, coverage, knockout, cost, impact, generators | ≥ 85% line coverage on `src/lib` |
| Invariants | Vitest | one named test per CLAUDE.md §4 invariant (`tests/invariants/I01-pack-driven.test.ts` …) | all green, never skipped |
| Pack | `pnpm pack:validate` | ≥ 500 checks per deep pack (04 §7) | zero errors |
| Golden | Vitest | every scenario × every persona expectation vs `golden.json`; cross-surface consistency (KPI tile = playground = agent = knockout baseline) | exact match |
| Eval | `pnpm eval --mode scripted` | every production agent meets manifest thresholds in scripted mode | pass |
| Live eval (optional) | `pnpm eval --mode live` (needs key) | groundedness + golden agreement | ≥ 95% agreement; report only |
| Integration | Vitest + temp SQLite/DuckDB | server actions: access workflow, triage, certify, publish gate, reset | pass |
| E2E | Playwright | primary journeys per module (AC IDs in `01`) | pass on utilities + one other deep pack per PR; all packs nightly |
| Stories | Playwright | all 6 stories × deep packs (09 §5) | pass nightly + before release |
| A11y | @axe-core/playwright | every route, light + dark | zero serious/critical |
| Perf | Playwright traces + vitest bench | budgets in `01` §5 | within budget |
| Security | Vitest | sql-safety fuzz (200 payloads), injection corpus, persona cookie tamper, secret-leak scan | pass |

## 2. Golden workflow

`pnpm golden --pack <id>` builds the warehouse at scale M and records, per scenario: compiled SQL hash,
result rows (rounded per metric), headline text, and per-persona variants. Committed `golden.json` is
reviewed in PR with a generated diff report (`tests/golden/report.md`). Golden is the contract for
scripted mode **and** the reference for live-mode agreement.

## 3. Determinism checks

- Build the same pack twice → identical DuckDB table checksums (`SELECT md5(string_agg(...))` per table).
- Grep-lint: no `Math.random`, `Date.now`, `new Date()` without args in `src/lib/{warehouse,query,agents/scripted,strategy}`.

## 4. CI pipeline (GitHub Actions)

1. install (pnpm, cache) → 2. typecheck + eslint (incl. boundaries + no-domain-strings + no-duckdb-import)
→ 3. unit + invariants → 4. pack:validate (all) → 5. golden (changed packs) → 6. eval scripted
→ 7. build → 8. e2e (utilities + 1) + a11y → 9. docker build. Nightly: all packs e2e + stories + perf.

## 5. Definition of Done (every phase)

- Phase checklist in `11-build-plan.md` satisfied, AC tests for the phase's modules green.
- No TODO without an issue link; no skipped tests; no `any`; lint clean.
- Docs updated: `docs/RUNNING.md`, affected spec section "As built" notes, ADRs for new decisions.
- Phase report: what was built, deviations, test summary, screenshots of new screens.
