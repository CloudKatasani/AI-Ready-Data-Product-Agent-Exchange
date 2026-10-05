# 09 — Presenter Mode & Demo Stories

## 1. Story model (`packs/_shared/stories.yaml`, pack overrides by step id)

```yaml
- id: business-15
  title: "From raw data to a trusted answer"
  minutes: 15
  audience: [executive, data leader]
  doors: [HOME, CONSUME, BUILD, RUN, STRATEGY]
  steps:
    - id: b1
      title: "The question nobody can answer today"
      go: { route: home, persona: A, state: { agentMode: scripted } }
      do: ["Type the hero question", "Point at the trace: 7 layers in 1 second"]
      say: "Your {{persona.A.title}} asks a plain question. Watch what has to be true for this answer to be right."
      expect: { answerKind: answer, citations: ">=2" }
```
`go` sets route + persona + UI state (selected product/agent/tab, toggles) via `presenter/apply.ts`.
Placeholders `{{…}}` resolve against the pack (personas, products by role tag, KPIs, incidents) so one
story works across every pack. Each pack must tag the products/agents/scenarios that stories reference:
`story_roles: { heroScenario, certDemoProduct, lifecycleDemoProduct, incidentForStory, knockoutKpi, qualityFixAgent }`
in `pack.yaml`.

## 2. The six standard stories

### S1 — Executive 5′ ("Trust the number")
1. Home as **E (Executive)**: headline KPI tiles; ask the hero question via Router → cited answer.
2. Open the trace; click a citation → product page with certification seal and owner.
3. Switch to **A**: same question → region-filtered, PII masked; "the system knows who you are".
4. Why AI-Ready → Knockout: turn off Context → KPI jumps by declared delta, confidence Unsafe/Questionable.
5. Readiness: apply the "Mid-migration" preset → band + top 3 gaps → "here's your path" (Roadmap).

### S2 — Business 15′ ("From raw data to a trusted answer")  — merges AI-Ready business story
1. Platform Map: replay the flow (one record from Bronze to an agent answer).
2. Explorer as **B**: Bronze dirty rows → Silver cleaned → Gold star; lineage graph; switch to **D** to
   show unmasking.
3. Semantic & Glossary: the KPI metric, its term, business rule; Playground equals the KPI tile.
4. Product Studio: cert demo product at Stage 11 → 2 checks fail/warn → apply fixes → certify (as D,
   governance council quorum by switching persona) → v1.0.0 published.
5. Marketplace as **A**: product now Certified but Restricted → request access (policy preview) →
   switch to **D**, approve → back to **A**: Granted.
6. Ask as **A**: previously declined question now answers with citation of the new product.

### S3 — Platform deep-dive 30′ (architects/engineers)
1. Explorer DDL: Iceberg/Dynamic Tables/streams (display), worksheet query with persona policies.
2. Semantic view YAML export; verified queries; Playground SQL.
3. Ask in **Live** mode (if key) — show tool calls, MetricQuery JSON, grounding validator; then flip to
   Scripted and show the identical numbers.
4. Data Health: Break "late feed" → product Degraded → agent answer banner + confidence drops → blast
   radius → Resolve → postmortem.
5. Impact: rename a Gold column → blast radius → contract major bump + 30-day notice plan.
6. Cost & Value: what-if levers; per-answer token cost from live answers.
7. Build Guide: switch tooling (e.g. Fivetran + Airflow vs Openflow + Tasks) → generated runbook.
8. Exports: ODCS contract, OpenLineage, Evidence Pack.

### S4 — Implementation 15′ (delivery) — AI-Ready implementation story
Readiness (preset) → Roadmap (generate) → Coverage heatmap ("Simulate +4 weeks") → Operating Model RACI
(switch style) → Portfolio (WSJF + human override) → Maturity.

### S5 — Agent Factory 10′ ("Agents are products too")
1. Factory as **C**: purpose from a pack decision; select 2 certified products → coverage proposed.
2. Agent Designer drafts instructions (live or template); edit one line.
3. Evaluate → one boundary case fails → add out-of-scope item → re-run → pass.
4. Publish gate: try binding the in-certification product → blocked (check 2) → remove → passes →
   approval as **D** → Pilot → Canary 20% → Production.
5. Ask the new agent a question; show it in Marketplace and the Agent Mesh.

### S6 — Governed lifecycle 15′ ("Agents act, humans decide")
1. Request a Product as **A** (intake wizard) → duplicate suggestion shown → submit anyway.
2. Triage as **C** → approve → product at Stage 1.
3. Autopilot to Stage 3 → Profiling agent proposes from **real** profiling → accept/edit → critic comment.
4. Show "submit blocked: unreviewed agent fields" → review → submit → approve gate.
5. Jump to the lifecycle demo product (Stage 6, open proposals) → edit the contract → Stage 5 gate STALE.
6. Evidence pack export; audit stream filtered to AGENT actions — none are approvals.

Free roam = no rail; presenter menu still available.

## 3. Presenter overlay features

- Cue card (do / say), step timer and total timer, next-step preview.
- Spotlight: dims page except a CSS selector target defined in the step (`spotlight: '[data-tour=gate-panel]'`).
- Guided tour engine (ported ADPM `tour.tsx`) reused for Spotlight and for self-guided mode
  ("Leave-behind mode": client can run the story themselves with on-screen prompts).
- Reset to step: each story step may declare `checkpoint: true`; checkpoints are snapshots taken the
  first time the step is reached after a reset, so the presenter can rewind to the step.
- Recording: "Export story as PDF" — screenshots per step (Playwright in a worker) with cue text for leave-behind decks.

## 4. Demo Profiles & personalisation

- Create from Launcher; stored in `DemoProfile`; snapshot taken on save (§ `02` 5.4).
- Branding (logo, colours, product name, company name) and terminology overrides apply via a request-
  scoped `presentation` context; overrides apply to display strings only — IDs and SQL unchanged
  (display SQL substitutes overridden region literals via a mapping table so numbers stay consistent).
- Profile export/import (`.keystone-profile.json`) to share setups between presenters (no secrets).

## 5. Acceptance

- `tests/stories/<story>.spec.ts` runs every story against every deep pack: each step's `go` then its
  `expect` block; screenshots stored as artifacts. A story is "ready" for a pack only if green.
- Story run time in automated mode < 90 s per story per pack.
