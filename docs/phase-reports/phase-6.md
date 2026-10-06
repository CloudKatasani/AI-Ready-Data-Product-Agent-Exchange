# Phase 6 — Live LLM, Agent Factory, three more deep packs

Status: **complete**. Date: 2026-10-06. Phase 7 follows on.

## Built

| Deliverable | Where |
|---|---|
| **Live engine**:<br>• System prompt and seven tools with Zod-validated arguments, emitted as JSON Schema: `list_metrics`, `semantic_query`, `search_context`, `get_definition`, `get_product_status`, `request_access_link`, `submit_answer`.<br>• `result_id` references; a loop with budget and timeout; one repair turn.<br>• Answers carry citations, banners, trace, tool calls, tokens and illustrative cost.<br>• Model comes from env (`KEYSTONE_MODEL_*`); the API key is read only through `anthropicApiKey()` (I11). | `src/lib/agents/live/` |
| **Grounding validator**:<br>• Every number must come from a cited result or a simple derivation (difference, ratio, % change).<br>• Masked-value leakage check; unentitled-product check.<br>• Label digits are stripped first ("30+ days past due"). | `src/lib/agents/grounding.ts` |
| **Runtime modes**:<br>• `scripted`, `live`, and `auto`.<br>• `auto` falls back visibly to scripted (`live_fallback` plus a reason banner); it is never an error.<br>• Injection probes are declined before any model call.<br>• Ask console has a mode selector and shows tool calls in the inspector. | `src/lib/agents/runtime.ts`, `src/lib/presenter/ask.ts`, `llm.ts` |
| **Lifecycle agents, live provider**:<br>• A `propose` tool validated against the artifact field schema.<br>• Falls back to the heuristic provider when no key is set or on error. | `src/lib/agents/lifecycle-agents/live.ts` |
| **Eval harness** with suites:<br>• golden: scenarios against `golden.json`, plus verified queries for the agent's KPIs<br>• groundedness<br>• boundary: out-of-scope topics and other agents' questions<br>• entitlement: persona A must get filtered rows or a decline<br>• adversarial: the shared probes<br>• compositional: n/a in v1<br>Results are persisted as EvalRun and EvalCaseResult. | `src/lib/agents/eval.ts` |
| **Publish gate**: 8 checks — bound products certified, coverage, instructions, eval thresholds, adversarial, budgets, owner, human approval.<br>**Release**: `recordDecision` AGENT_PUBLISH handles pilot → canary → production. Rollback is not an approval. | `src/lib/agents/factory.ts`, `src/lib/lifecycle/decisions.ts`, `src/lib/presenter/factory.ts` |
| **Agent Factory UI**: seven steps — purpose, data, coverage (proposed from the bound products), instructions (Agent Designer drafts), eval, gate, release.<br>Factory agents live in the Agent table and are merged into the live pack, so the Marketplace and Ask see them. | `src/app/[pack]/(builder)/factory`, `src/components/factory/` |
| **Deep packs: banking** (Ridgeline Bank), **healthcare** (Crestview Health System), **retail** (Harbor & Pine). Each pack has:<br>• 6–7 domains, 14–16 Bronze tables, 7–8 semantic views, 30–36 KPIs<br>• 24–25 scenarios covering all 15 patterns<br>• 61–69 verified queries<br>• 5 agents, 8 products in the required status mix<br>• 5 incidents, plus knockout, value, demand and readiness files<br>• its own cert-demo product (FIX-1 / FIX-2) and lifecycle-demo product | `packs/banking`, `packs/healthcare`, `packs/retail` |
| **Verified-query answer path** (ADR-0018). Scenario fit also rejects a curated match when the question names a metric the agent doesn't cover. | `src/lib/agents/scripted/verified.ts`, `respond.ts` |

## Definition of Done

| Check | Result |
|---|---|
| **AC4.2**: a live golden question returns the same headline numbers or falls back visibly | ✅ Integration test with a scripted fake model client: same numbers. Grounding violations are repaired once, then fall back. e2e: in auto mode with a planted fake key, the answer is scripted with a visible fallback badge |
| **AC4.4**: prompt-injection probes are declined, never tool misuse | ✅ Integration test (live, with the fake client: no model call is made). Adversarial suite: 15 probes × 16 production agents across four packs, all declined with no query run |
| **AC7.1**: an agent bound to a non-certified product cannot pass the publish gate | ✅ Integration test. The e2e checks individual gate rows: certified binding passes, and human approval is pending until release |
| **AC7.2**: a factory-built agent answers ≥ 80% of its generated golden set in scripted mode | ✅ Integration test and e2e. The e2e builds, evaluates, gates and releases pilot → canary → production; the agent then appears in the Marketplace and answers in Ask |
| Golden + eval green for each new pack | ✅ `pnpm golden`: 0 differences on utilities (23), banking (25), retail (25) and healthcare (24). `tests/integration/eval-packs.test.ts`: every production agent of every deep pack passes every suite threshold (16 agents) |
| Live eval report for utilities | ⏭ Not produced: no `ANTHROPIC_API_KEY` is configured in this environment. With a key set, run the eval with `mode=live` from the Factory |

Totals:
- `pnpm test`: 32 files, 380 tests passing (12 `todo` for later phases).
- `pnpm test:e2e`: 144 passing.
- `pnpm pack:validate`: 0 errors on all four packs. Banking ran 4,340 checks, healthcare 4,619 and retail 4,589.
- Lint (including the domain-string lint over 494 terms from four packs), typecheck and build are clean.

## Notes and decisions
- **Engine fixes from pack authoring**:
  - The record-level and injection guards now beat a matched aggregate scenario (ADR-0015 amended).
  - A full out-of-scope phrase beats a curated match.
  - Phrases that rely on a stop word must match verbatim ("out-of-stock" is not "in-stock").
  - Record ids with up to four-letter prefixes (MRN-00001234) are caught.
  - `{{vsTarget.*}}` on multi-row results compares the total, not the first row.
  - Utilities SC-UTL-007 headline: "better than" changed to "within target". The year-to-date total sits inside the band; the old wording compared January alone.
- **Known content quirk, not changed**: the "top members/patients/customers by risk" scenarios group by full name, and generated names collide. The figure is a per-name average. This is noted for Phase 10 pack review.
- **Canary routing**: an agent holds one published version and a release stage. Splitting traffic by question hash between two versions is not implemented in v1. Rollback returns the agent to the previous stage.
- **Tests**: the global setup builds (content-hash cached) and seeds every pack that loads, so AC tests can run per pack.
