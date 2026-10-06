# Phase 8 — Strategy

Status: **complete**. Date: 2026-10-06. Phase 9 follows on.

## Built

| Deliverable | Where |
|---|---|
| **Knockout in the compiler and QueryService**:<br>• Semantic off: naive formulas, no rules.<br>• Context off: no business rules.<br>• Gold off: Gold-shaped projections over the declared Silver fallbacks.<br>• Silver off: raw Bronze with CDC duplicates.<br>• Governance off: no masking or row access; flagged Unsafe.<br>Each is logged as a `knockout` policy and allowed only for the knockout purpose (ADR-0020). | `src/lib/query/compiler.ts`, `query-service.ts`, `src/lib/strategy/knockout.ts` |
| **Declared deltas** for all four deep packs, computed through that path by `pnpm knockout:deltas --update` and enforced by tests | `packs/*/knockout.yaml`, `scripts/knockout-deltas.ts` |
| **Why AI-Ready — Knockout**: six layer switches; for each of the 4 answers, governed vs knocked-out value, change, failure type, confidence, policies and the SQL that ran.<br>**Compare**: raw stack vs governed stack per question, with a scorecard and both SQLs side by side | `(strategist)/why/knockout`, `why/compare` |
| **Readiness**: ported verbatim — 21 questions, 7 dimensions, presets (pack-labelled), scores, rubric bands, ranked gaps with actions.<br>Radar against the demo estate; answer live; save as a named assessment | `src/lib/strategy/readiness.ts`, `(strategist)/readiness`, `ReadinessAssessment` model |
| **Roadmap**: ported seven phases with gates, proof links, workstreams, risks and roles. A Gantt is generated from the readiness gaps (latest saved assessment, a live answer set, or the mid preset), with "you are here" and the gap-closing phases highlighted | `src/lib/strategy/roadmap.ts`, `(strategist)/roadmap` |
| **Portfolio**:<br>• Pipeline by lifecycle phase.<br>• WSJF-with-reuse / RICE (ADPM), from pack-derived inputs.<br>• **Human override with a mandatory reason**: audited and re-ranks.<br>• Run cost, adoption (answers), and value expected vs realised.<br>• **Six-dimension maturity derived from live-estate evidence** | `src/lib/strategy/portfolio.ts`, `maturity.ts`, `(strategist)/portfolio`, `PrioritisationOverride` model |
| **Operating Model**: ported RACI — 9 roles × 25 activities × 3 styles, with activities linked to Keystone screens | `src/lib/strategy/raci.ts`, `(strategist)/operating-model` |
| **Platform Map**:<br>• Nine-layer stack: what each layer holds and what breaks without it (from the knockout declarations).<br>• Flow replay of the headline KPI from a Bronze source to the agent; honours reduced motion.<br>• Guided five-step path | `src/lib/strategy/platform.ts`, `(strategist)/platform-map` |

## Definition of Done

| Check | Result |
|---|---|
| **AC11.1**: turning Context off in Knockout changes the flagged KPI by the declared delta | ✅ Integration test on **all four deep packs**: SAIDI +80%, NPL +63.4%, readmissions +31.3%, net sales +44.4%, failure `context`, not Trusted. e2e on utilities: the answer card shows delta 80 and the Wrong chip |
| **AC11.2**: readiness scores for the three presets match the ported engine's fixtures | ✅ Fixtures were produced by running AI-Ready `ext/readiness.ts`:<br>• early: 1.3 Exploring<br>• mid: 2.1 Foundational<br>• advanced: 3.5 Operational<br>The integration test checks every dimension score and the top-3 gaps; band boundaries are tested too. e2e: the early preset gives 1.3 Exploring, and its roadmap starts at phase 3 |
| Knockout deltas match pack declarations for all deep packs | ✅ Every answer × every layer × four packs is within ±0.1, and undeclared means not computable. Governance off is Unsafe everywhere; all-on is Trusted with zero change |

Totals:
- `pnpm test`: 34 files, 420 tests passing; 9 `todo` remain, all Phase 9.
- `pnpm test:e2e`: 183 passing, including axe scans of 11 new strategist URLs.
- Lint, typecheck, build and golden (0 differences) are clean.

## Notes and decisions
- **ADR-0020**: knockout recomputes through the governed path. Deltas are generated, then enforced like golden answers. Maturity is evidence-based. Build Guide is not ported because it is not an M11 screen.
- **Large deltas are deliberate**, from the pack failure narratives. For example, utilities SAIDI with Gold off rises about 79× because the feeder-level customer count replaces the system denominator. The pack declares that as `wrong`.
- **Silver off** is *not computable* where Silver derives columns that Bronze lacks (utilities SAIDI, banking NPL). The card says so; that is the point of the layer.
- **Accessibility fixes**: labelled code blocks now carry `role="region"`, and the pipeline links meet the 24px target size.
