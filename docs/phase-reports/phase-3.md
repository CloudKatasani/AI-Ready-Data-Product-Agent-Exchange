# Phase 3 — Scripted agents & Ask

Status: **complete**. Date: 2026-10-06. Per the instruction to continue to the end, Phase 4 starts next
without waiting.

## Built

| Deliverable | Where |
|---|---|
| **Scripted engine** (08 §3). Guardrails (injection, out-of-scope, record-level), then TF-IDF scenario matcher (questions and paraphrases, synonym expansion), redirect to a better agent, **coverage planner** (TS port of the marketplace planner: KPI, slice, grain, window, top-N with direction, target, share, distribution, region and value filters), clarify, then help. Matched answers run through QueryService (`purpose: 'agent'`), render with templates (bare numbers, locale formatting) and cite their sources. Every answer carries a 7-step trace, banners and a confidence label | `src/lib/agents/scripted/*`, `src/lib/agents/types.ts` |
| Scripted **router** across agents (hero box and the "let the router choose" option) | `src/lib/agents/scripted/router.ts` |
| **AnswerRecord, AnswerFeedback** models and migration; `ask()` service persists every answer | `prisma/`, `src/lib/presenter/ask.ts` |
| **`POST /api/ask`** (SSE: `routed`, `step`×7, `answer`, `done`; persona from the signed cookie only; errors render as a calm message) and **`POST /api/feedback`** | `src/app/api/ask`, `src/app/api/feedback` |
| **Ask screen**. Left: agent picker and suggested questions. Centre: conversation of answer cards (headline, narrative, chart, masked-aware table, citation chips, confidence, banners with a Request button, mode badge, follow-up and clarify chips, redirect button, 👍/👎 with reason). Right: **inspector** with Trace, SQL, Sources and Policy tabs. `?q=` deep links answer on load | `src/app/[pack]/(consumer)/ask`, `src/components/answer/*` |
| **Home**: hero ask box (routes through the router), 4 headline **KPI tiles** (compiler value over the KPI window, target band status, 12-month sparkline, link to the same Playground query), **Answer Theatre** (replays the pack's theatre scenarios step by step; pausable; respects reduced motion), estate counters, activity ticker (recent AnswerRecords), open-items panel, agent and product constellation | `src/app/[pack]/(consumer)/home`, `src/components/home/*`, `src/lib/presenter/home.ts` |
| **Golden**: `pnpm golden [--pack id] [--update]` records per scenario: SQL hash, rounded rows, headline, narrative, citations and persona variants (scale M). It writes `tests/golden/report.md` on update and exits 1 on drift | `scripts/golden.ts`, `src/lib/agents/golden.ts`, `packs/utilities/golden.json` |
| **Validator categories 7 and 8**. Scenarios: kind, scenario match, compiles, template resolution, citations, `expect` rows/top/rules/certified, persona expectations, paraphrases (warning), pattern coverage 1–15, KPI values within target ± tolerance. Agents: coverage bound to products and views, slices exist, ≥ 4 scenarios for production agents, scenario ownership, scripted pass rate ≥ `golden_min` | `src/lib/agents/validate.ts`, `scripts/pack-validate.ts` |
| Invariant **I07** (scripted): every numeric answer cites product@version, metric and SQL (the QueryLog id); every headline number appears in the governed result (or is a total or a difference between two cells) | `tests/invariants/I07-cited-answers.test.ts` |
| ADR-0015: answer precedence and rubric-driven record-level nouns | `docs/adr/0015-scripted-matching-precedence.md` |

Pack content changes:
- SC-UTL-008 became a distribution question over feeders, and AG-UTL-004 gained the `feeder` and `condition_band` slices.
- SC-UTL-001's headline names the top region.
- SC-UTL-021's headline now says "from the first to the latest quarter this year". The old wording ("versus the previous quarter") misdescribed the delta.
- `rubrics.yaml` gained `matcher.entity_nouns`.

## Definition of Done

| Check | Result |
|---|---|
| **AC2.1**: Home numbers equal the Semantic Playground | ✅ integration `ac9-playground.test.ts` (every headline tile = Playground query for the KPI window) and e2e (the tile's value equals the Playground value it links to) |
| **AC2.2**: hero question returns a cited answer in scripted mode | ✅ integration (router picks AG-UTL-002; product and metric citations) and e2e (hero box → Ask → cited answer, Scripted badge) |
| **AC4.1**: every golden scenario answers in < 800 ms and matches `golden.json` | ✅ `tests/golden/utilities.test.ts` at scale M: 23/23 equal; each well under 800 ms (typically 5–30 ms) |
| **AC4.3**: persona A gets region-filtered numbers and is told so | ✅ integration (rows limited to the allowed regions; narrative names the filter and the policy; row-filtered banner) and e2e |
| All utilities scenarios match golden | ✅ `pnpm golden --pack utilities` → 0 differences |
| Invariant I07 (scripted) | ✅ 18 answer scenarios × personas B and D, plus the number-in-result check |
| Bonus: AC4.4 in scripted mode | ✅ 15 adversarial probes × 5 agents → `decline` with no query executed |

Totals: `pnpm test` gives 20 files and 285 tests passing (24 `todo` for later phases). `pnpm test:e2e`: 96 passing (Ask and Home e2e plus axe scans of `/home`, `/ask` and `/ask/AG-UTL-002`). `pnpm pack:validate utilities`: 4,292 checks, 0 errors, 0 warnings. Typecheck, lint, the domain-string lint and `pnpm build` are clean.

## Notes and decisions
- Live and auto modes answer in scripted mode until Phase 6, with the badge showing `Live→Scripted fallback` and the reason. Never an error.
- Trace steps stream with ~90 ms pacing so the audience can watch the seven layers. `pace: 0` turns this off for tests.
- "Avg quality" on Home arrives with QualityScoreSnapshot in Phase 5. "Your open items" fills in when access requests (Phase 4) and gates (Phase 5) exist.
