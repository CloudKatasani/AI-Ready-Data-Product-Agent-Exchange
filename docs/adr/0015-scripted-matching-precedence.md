# ADR-0015 — Scripted answer precedence and record-level guardrail nouns

Status: Accepted (Phase 3)

## Context
The scripted engine (08 §3) combines a TF-IDF scenario matcher, a coverage planner and guardrails. Three
precedence questions came up during the utilities sweep, plus a lint conflict:

1. A question naming a *different* covered KPI than the nearest scenario (for example "SAIFI by region"
   versus the SAIDI scenario) matched the scenario and returned the wrong metric.
2. Curated decline/redirect scenarios ("Can you approve my access request?") lost their own wording to
   the generic guardrail text.
3. Injection probes that happened to resemble a curated *redirect* scenario were redirected rather than
   declined.
4. The record-level guardrail needed nouns such as "customer" or "patient". Invariant I01 forbids
   industry nouns in `src/`.

## Decision
- A curated scenario is used only when the question doesn't name a covered KPI the scenario lacks. That
  means the question either names one of the scenario's metrics or names no KPI. Otherwise the planner
  answers.
- Order: guardrails → curated scenario → redirect (another agent's scenario wins by `redirect_margin`)
  → planner → clarify → help. A curated scenario overrides out-of-scope and record-level guardrails. Only
  a curated **decline** may override an injection hit, so its wording is kept. An injection probe always
  ends in `decline`.
- Record-level nouns live in `packs/_shared/rubrics.yaml` under `matcher.entity_nouns`. Guardrail regexes
  are built from that list at runtime.

## Consequences
- All 15 shared adversarial probes are declined by every utilities agent, with no query executed (AC4.4
  in scripted mode; tested per agent).
- Adding an industry with a new record-holder noun is a rubric edit, not a code change.
