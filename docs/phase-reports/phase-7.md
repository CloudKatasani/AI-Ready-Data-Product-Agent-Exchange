# Phase 7 — Run (operate)

Status: **complete**. Date: 2026-10-06. Phase 8 follows on.

## Built

| Deliverable | Where |
|---|---|
| **Incident effects on the one query path**. Overlays are query-time subqueries for each kind (late feed, null spike, duplicate load, schema drift, volume anomaly) and are deterministic through `hash(key)`.<br>Masking and row access apply over the overlay. While an incident is open, products report `degraded` (`down` for a SEV1 drift).<br>A schema drift raises `IncidentBlocked` when a metric uses the renamed column (ADR-0019). | `src/lib/query/incidents.ts`, `query-service.ts`, `policies.ts` |
| **Answers under incidents**: both engines add an `incident` banner and drop confidence to Questionable. A blocked metric gives an incident decline (Unsafe). | `agents/scripted/respond.ts`, `agents/live/engine.ts` |
| **Incidents**:<br>• Break: idempotent, audited, and re-runs the affected products' DQ rules through the overlay.<br>• Resolve: writes a postmortem with time to detect (by kind), time to resolve, detection, impact, resolution and actions.<br>• `Incident` Prisma model. | `src/lib/operate/incidents.ts`, `presenter/operate.ts`, migration `20261006060000_phase7_operate` |
| **Health board**: freshness, volume, quality and schema signals plus the DQ score per product, from the latest rule results and open incidents. Marketplace cards show **Degraded** | `src/lib/operate/health.ts`, `(operator)/health` |
| **Impact / blast radius**: for an object or column, plus a change type, it lists downstream objects, views, metrics, KPIs, products, agents and consumers. It also gives a severity, contract bump, notice period (rubric), a generated change plan and the lineage graph. The same engine draws an incident's blast radius | `src/lib/operate/impact.ts`, `(operator)/impact` |
| **Agent Quality**:<br>• Scorecards: harness score, suites, run history and fixes.<br>• Feedback inbox: seeded 👎 on each pack's quality-fix question.<br>• Fix types: the suggested fix, or a steward synonym fix; both are written as a **versioned KnowledgeOverlay** (superseding older versions) that `livePack()` merges.<br>• Each fix re-runs the eval; before and after are stored in `QualityFixRun`.<br>• Certification fix-1 overlays now also activate their verified queries for agents. | `src/lib/operate/quality.ts`, `presenter/operate.ts`, `presenter/factory.ts`, `(operator)/agent-quality` |
| **Cost & Value** (port of AI-Ready `ext/cost.ts`, adapted to Keystone packs):<br>• Refresh, transformation, BI, storage, agents and DQ costs.<br>• Levers: lag factor, warehouse size, questions per day, credit price.<br>• Views: by driver, layer, product (freshness vs SLA, breach) and agent; live-mode token and cost actuals.<br>• Value tab: value cases with annualised cost and value ÷ cost, plus a portfolio roll-up. | `src/lib/operate/cost.ts`, `(operator)/cost-value` |
| **Audit & Lineage**: hash-chained event stream with actor and subject filters, chain verification status, audit-bundle export, and the full-estate lineage graph | `(operator)/audit` |

## Definition of Done

| Check | Result |
|---|---|
| **AC10.1**: breaking the "late feed" incident makes the dependent agent's next answer show an incident banner with confidence Questionable; resolving restores Trusted | ✅ Integration test on **all four deep packs** using each pack's `incidentForStory` and an affected agent's scenario: break → banner and Questionable, product not healthy on the board → resolve → same headline and confidence as before. Postmortem TTR ≥ elapsed. e2e: the UI path in utilities, including the Marketplace Degraded chip and the postmortem |
| **AC10.2**: applying the scripted agent-quality fix raises the eval by the pack-declared delta | ✅ Integration test on **all four deep packs**: the seeded 👎 is fixed, eval goes 88 → 94, the feedback becomes FIXED, and Ask now resolves the question to the fix's metric. e2e: the inbox moves 88% → 94% and the scorecard shows 94 |
| Overlay effects | ✅ Every utilities template changes counts, adds nulls or blocks the renamed column, and the audit chain still verifies. Invariant **I02** has a new incident-shadowing test (no longer `todo`) |
| Impact and cost engines | ✅ A renamed contracted Gold column gives high severity, a major bump, a 30-day notice, and a plan that reaches agents. Cost is deterministic, and a fresher lag costs more |

Totals:
- `pnpm test`: 33 files, 394 tests passing. 9 `todo` remain, all for Phases 8–9.
- I07's two live-grounding placeholders are now real tests.
- `pnpm test:e2e`: 165 passing, including axe scans of the 12 new operator URLs.
- Lint (domain-string lint: 4 packs, 494 terms), typecheck and build are clean. Golden: 0 differences on all four packs.

## Notes and decisions
- **ADR-0019**:
  - Overlays are query-time subqueries rather than `_INCIDENT` DDL. The warehouse stays read-only, and reset stays a snapshot copy.
  - The quality-fix agent's score shows the pack-calibrated before/after numbers. The "after" number only appears when the fix demonstrably resolves the feedback question.
- **Late feed** hides rows newer than the object's latest timestamp minus the lag. This is relative to the data's own maximum rather than the clock, so the shift is visible at every scale.
- **Answer records are append-only**. A re-seed reuses the seeded feedback's answer record and resets the feedback to NEW instead of deleting it.
- **Platform agents** (Quality Fixer, Incident Explainer, 08 §6) use their deterministic forms here: the pack's suggested fix and the template narrative. Live variants can be added with the other live platform agents.
