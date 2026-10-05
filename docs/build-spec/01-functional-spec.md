# 01 — Functional Specification

## 1. Vision and demo outcomes

**One sentence:** Keystone lets a consultant sit with any enterprise client and, in 5 to 45 minutes,
show their industry's data going from raw to governed data products to trusted AI agents — with every
number cited, every decision made by a human, and the whole estate measurably operated.

**Demo outcomes a client must leave with**

1. "AI is only as good as the layers under it" — proven live (Knockout, Raw-vs-AI-Ready).
2. "Data products are how you make data trustworthy at scale" — shown as a governed lifecycle with
   agents doing the work and humans deciding.
3. "Agents are products too" — catalogued, evaluated, gated, released, observed, rolled back.
4. "This is your business" — their industry, their KPIs, their company name and brand on screen.
5. "Here is where you are and what to do next" — readiness score, gaps, generated roadmap.

**Non-goals (v1):** production multi-tenancy, real SSO, connecting to client data, real pricing,
mobile-first layouts (tablet ≥ 1024 px and desktop are supported; phone is view-only).

## 2. Personas

### 2.1 Users of the application (people in the room)

| Persona | Goal | Primary screens |
|---|---|---|
| **Presenter** (consultant/SE) | Run a reliable, tailored story; recover instantly | Launcher, Story Rail, Presenter menu, reset |
| **Client executive** | See value, risk control, path forward | Home, Ask, Value, Readiness, Roadmap |
| **Client data leader / CDO** | Operating model, governance, lifecycle, portfolio | Product Studio, Portfolio, Audit, Operating Model |
| **Client architect / engineer** | How it's built, which Snowflake features, SQL | Explorer, Semantic, Build Guide, Agent Factory, trace/SQL |
| **Client business user** | Can I get an answer I trust today? | Marketplace, Ask, My Access, Request |

### 2.2 In-app demo personas (identities you switch between)

Each pack defines exactly these five archetypes (names/titles from the pack):

| Archetype | Example (Utilities) | Roles | Data visibility |
|---|---|---|---|
| **A — Business consumer** | "Regional Ops Manager, North" | DATA_CONSUMER | Row filter (own region), PII masked |
| **B — Analyst** | "Reliability Analyst" | DATA_CONSUMER, ANALYST | All rows, PII masked |
| **C — Product owner / builder** | "Grid Data Product Owner" | DOMAIN_PRODUCT_OWNER, DATA_ENGINEER | All rows, PII masked, can build |
| **D — Steward / governance** | "Customer Data Steward" | DATA_STEWARD, GOVERNANCE_COUNCIL, PRIVACY_OFFICER | Unmasked, approves |
| **E — Executive** | "COO" | EXECUTIVE, PORTFOLIO_LEAD | Aggregates only; sees portfolio and value |

Switching persona (top bar, or `Ctrl+Shift+P`) re-renders every screen with that identity's
entitlements, masking and row filters, and is the most important demo gesture.

## 3. Information architecture

Left navigation grouped by door; doors collapse/expand; presenter can hide doors per story.

```
HOME            Home (landing)
CONSUME         Marketplace · Ask an Agent · My Access · Request a Product
BUILD           Product Studio · Agent Factory · Explorer · Semantic & Knowledge (Semantic · Glossary · Context)
RUN             Health · Agent Quality · Cost & Value · Impact · Audit & Lineage
STRATEGY        Platform Map · Why AI-Ready (Knockout · Compare) · Readiness · Roadmap · Portfolio · Operating Model
PRESENT         (hidden; presenter overlay + /launch)
```

Global chrome: top bar (brand, pack/company switch, persona switcher, global search `/`, command
palette `Ctrl+K`, mode badge `Scripted | Live | Auto`, presenter `⋯` menu), story rail (when a story is
active), footer ("Synthetic demo data · as of {asOf}").

Routes (`src/app`): `/launch`, `/[pack]/home`, `/[pack]/marketplace`, `/[pack]/marketplace/products/[id]`,
`/[pack]/marketplace/agents/[id]`, `/[pack]/ask/[agentId?]`, `/[pack]/access`, `/[pack]/request/new`,
`/[pack]/request/[id]`, `/[pack]/studio`, `/[pack]/studio/[productId]/[stage?]`, `/[pack]/factory`,
`/[pack]/factory/[draftId]`, `/[pack]/explorer/[schema?]/[object?]`, `/[pack]/semantic/[view?]`,
`/[pack]/glossary/[term?]`, `/[pack]/context/[section?]`, `/[pack]/health/[tab?]`,
`/[pack]/agent-quality/[tab?]`, `/[pack]/cost-value`, `/[pack]/impact`, `/[pack]/audit`,
`/[pack]/platform-map`, `/[pack]/why/knockout`, `/[pack]/why/compare`, `/[pack]/readiness`,
`/[pack]/roadmap`, `/[pack]/portfolio`, `/[pack]/operating-model`, `/[pack]/admin`.

## 4. Module specifications

Each module lists screens, behaviour, and **acceptance criteria (AC)** that become Playwright tests.
"Pack content" means every label/value comes from the active pack.

---

### M1 — Demo Launcher & Presenter (`/launch`, overlay)

**Launcher screen**
- Grid of industry cards (icon, fictional company, 1-line hook, # products/agents/KPIs, depth badge
  `Deep | Standard | Draft`).
- Selecting a card opens **Profile setup** drawer:
  - Company display name (defaults to pack's fictional company), optional logo upload (SVG/PNG ≤ 200 KB,
    stored in DB as data URL), primary/accent colour pickers with live contrast check.
  - Region/terminology overrides (e.g. rename "North/South/East/West" to client service territories) —
    simple key→value list from `pack.yaml#overridable`.
  - Story picker (§ `09-presenter-and-stories.md`): Executive 5′, Business 15′, Platform Deep-Dive 30′,
    Implementation 15′, Agent Factory 10′, Free roam.
  - Agent mode: Scripted (default) / Auto / Live (Live disabled if no API key; tooltip explains).
  - "Lock to this profile" (hides launcher; kiosk mode).
- Saved profiles list (name, pack, last used, duplicate, delete-archive).
- **AC1.1** Launching a profile lands on `/[pack]/home` in < 2 s with branding applied.
- **AC1.2** Brand colours failing AA contrast are rejected with a suggested accessible alternative.
- **AC1.3** Profiles persist across server restart.

**Presenter overlay** (toggle `Shift+P`, or `⋯` menu)
- Story Rail: steps with titles; current step highlighted; "Go" navigates and sets the UI state
  (persona, selected product, tab); cue card shows talking points and "say this / click this".
- Actions: Reset demo (confirm), Break something (pick incident), Fix it, Switch persona, Jump to
  step, Toggle agent mode, Hide door, Spotlight (dim everything except a target element), Show SQL
  everywhere toggle, Timer.
- **AC1.4** Reset restores the profile's starting state in < 3 s, keeping the profile/branding.
- **AC1.5** Every story step's "Go" produces the documented state (tested per pack in `tests/stories`).

---

### M2 — Home (`/[pack]/home`)

Business-friendly landing that makes the estate feel alive.
- Hero: company name, "Ask anything about {domain list}" box → routes to best agent (uses router agent
  in scripted mode = matcher across all agents).
- **Answer Theatre**: auto-playing replays of 3 golden Q&As (pack content), pausable.
- **Constellation**: animated graph of agents (nodes) linked to products they use; hover shows KPI coverage.
- Counters: certified products, production agents, KPIs governed, questions answered (7d), avg quality.
- Activity ticker (SSE, simulated from `AnswerRecord`/`AuditEvent` + scripted background events).
- Industry KPI tiles: 4 headline KPIs with target band and trend sparkline (computed via compiler).
- "Your open items" for current persona (approvals, requests, incidents).
- **AC2.1** All numbers on Home equal the same metrics computed in Semantic Playground.
- **AC2.2** Hero question "{pack.home.heroQuestion}" returns a cited answer in scripted mode.

---

### M3 — Marketplace (`/[pack]/marketplace`)

Unified catalog of **Data Products** and **Agents** (tab or "All").
- Search box (BM25 over name, description, KPI names, synonyms, glossary terms) + facets: type,
  domain, status (Certified/In certification/Draft/Deprecated), certification tier, KPI, sensitivity,
  consumption pattern, owner, "accessible to me", "has agent".
- **Product card**: name, domain, status chip, version, **quality ring** (0–100), freshness vs SLA,
  consumers, attached agents (avatars), sensitivity chips, access badge for current persona
  (`Granted | Pending | Requestable | Restricted`).
- **Agent card**: name, avatar, status (Production/Pilot/Canary), eval accuracy, products used, KPIs
  covered count, cost/answer, "Ask" button.
- Compare (select up to 3 products → side-by-side table of contract, SLA, quality, KPIs, patterns).
- **Product detail** tabs: Overview (purpose, decision supported, sample questions → "Ask"), Contract
  (rendered ODCS-style; download YAML), Schema (columns, types, tags, glossary links, masking state for
  persona), Quality (rules, scores trend, open incidents), Lineage (graph Bronze→…→Agent, column-level
  on click), Semantic (metrics, verified queries), Consumption (patterns + endpoints: SQL, semantic
  view, API, agent), Agents (who uses it), Value (value case), History (versions, certifications).
- **Agent detail** tabs: Overview (capability, personas, out-of-scope), Coverage map (KPI × grain ×
  slice matrix), Products & tools, Instructions (versioned), Evaluation (suites + scores), Release
  (live/canary/rollback target), Usage & cost, Try it.
- **Request access** (drawer): purpose category (pack list), justification, duration; **policy
  preview** shows which rules apply, required approvers, auto-approve eligibility, masked columns
  that will remain masked. Submit creates `AccessRequest`; approvers see it in their inbox.
- **Demand board** (`marketplace?tab=demand`): requests for products/agents that don't exist yet;
  vote, duplicate check on submit, link to intake.
- **Mesh** (`marketplace?tab=mesh`): data mesh (products linked by shared upstream sources/entities)
  and agent mesh (agents linked by shared KPIs/products); select a node → blast radius highlight.
- **AC3.1** Persona A sees Restricted on a product outside their entitlement; requesting it, switching
  to Persona D, approving, and switching back shows Granted and the agent can now answer.
- **AC3.2** Search "outage minutes" (utilities) returns the reliability product and the SAIDI KPI via
  synonym; equivalent golden searches exist for every deep pack.
- **AC3.3** Quality ring value equals the latest `QualityScoreSnapshot` for the product.

---

### M4 — Ask an Agent (`/[pack]/ask/[agentId]`)

The centrepiece. Left: agent picker + suggested questions (agent's scenarios). Centre: conversation.
Right: **Answer inspector** (tabs: Trace · SQL · Sources · Policy).
- Answer card: headline (one sentence), narrative (≤ 3 sentences), chart (bar/line/table auto from
  result shape), table (masked cells shown as `•••` with tooltip naming the policy), citations chips
  (product@version, metric, verified query), confidence label (`Trusted | Questionable | Unsafe` from
  certification + incidents), banners: not-certified, no-access (with Request button), masked,
  incident (with link to Health).
- **Trace** ("How I answered") — 7 steps aligned to layers, each with timing and refs:
  Understand (Glossary terms resolved) → Apply context (rules, synonyms) → Choose model (semantic view,
  metric) → Check access (policies applied for persona) → Query (SQL, rows, ms) → Ground (documents
  cited) → Answer (citations validated). In live mode the trace also lists tool calls and token/cost.
- Kinds: `answer`, `decline` (no access / out of scope → names the agent that covers it and offers
  Request), `clarify` ("did you mean…" with 2–3 options), `redirect` (better agent), `help` (lists KPIs).
- Follow-ups: chips ("by region", "last 4 quarters", "why?") generated from coverage slices/grains.
- Feedback: 👍/👎 with reason; 👎 creates an `AnswerFeedback` item in Agent Quality inbox.
- Mode badge per answer: `Scripted` / `Live` / `Live→Scripted fallback` (with reason on hover).
- Free text in Scripted mode: matcher over scenarios + paraphrases + coverage-based planner (ported
  marketplace planner) so reasonable unscripted KPI questions within coverage still answer.
- **AC4.1** Every golden scenario answers in scripted mode in < 800 ms with values matching
  `golden/<pack>.json`.
- **AC4.2** In live mode, a golden question returns the same headline numbers (tolerance rules) or
  falls back with badge — never an error.
- **AC4.3** Asking a covered question as Persona A returns region-filtered numbers and states the filter.
- **AC4.4** Prompt-injection probes in `tests/golden/adversarial.json` produce `decline`, not tool misuse.

---

### M5 — My Access & Request a Product

**My Access** — products/agents the persona can use; KPI coverage matrix (KPI × "can I answer it?"
with reason); pending requests; entitlement expiry.

**Request a Product** (intake wizard, ported from ADPM) — 5 steps: decision you're blocked on →
who decides / how often / current workaround → questions you'd ask (≥ 3) → stakes & freshness →
review. Duplicate detection suggests existing products/agents ("This might already answer it — try
asking"). Submitting creates a `ProductRequest` (state `SUBMITTED`) visible to Persona C/D for
triage (approve → creates Draft product at Stage 1 with the decision record pre-filled; merge; decline
with reason). SLA clock shown.
- **AC5.1** A request whose questions match an existing scenario surfaces that product as a duplicate
  candidate with similarity ≥ threshold (rubric).
- **AC5.2** Approving triage creates a product in Product Studio, Stage 1, with decision record linked.

---

### M6 — Product Studio (`/[pack]/studio`) — governed lifecycle

List view: Kanban by **phase** (Discover, Design, Build, Certify & Publish, Operate) or table. Filters
by domain/owner/stage/blocked. Each card: stage n/12, gate state, open proposals, staleness flags.

**Product workspace** (`/studio/[id]/[stage]`): stage nav (12 stages, grouped by phase, with gate
icons), main panel = stage artifact(s) form/editor, right panel = **Agent panel** + **Exit criteria**
+ **Gate**.
- Artifacts per stage (registry ported from ADPM; 25 types). For demo depth each artifact has a
  rich renderer (e.g. ER diagram via Mermaid, contract preview, lineage graph, quality rule table).
- **Agent panel**: lifecycle agent for this stage (e.g. Profiling Agent at Stage 3) → "Run" → shows
  streaming narrative, then proposals per field with Accept/Edit/Reject; Critic agent comments
  (anchored to fields). Provenance badge on every field (`Human` / `Agent — accepted by X`).
- **Profiling** (Stage 3) runs real profiling against the product's Bronze/Silver tables in DuckDB
  (null %, distinct, min/max, top values, pattern conformance) via QueryService.
- **Quality** (Stage 8) rules are executable SQL assertions; "Run rules" executes them and stores results.
- **Gate panel**: required roles, quorum, veto roles, evidence list (artifact versions + hashes),
  decisions so far. "Submit for review" disabled until exit criteria pass (with reasons).
  Approve/Reject by a persona with the role (switch persona to demo it).
- **Certification (Stage 11)**: 8 automated checks (ownership & purpose, contract, DQ ≥ rubric,
  semantic model ≥ 10 verified queries + eval ≥ 90%, glossary alignment, governance tags/masking/row
  policy/grants, lineage & observability, agent readiness) shown as a checklist with Fix actions; the
  pack's designated **certification demo product** starts with 1 warn + 1 fail and two scripted fixes.
  Certify → publish v1.0.0 (semver) → appears as Certified in Marketplace.
- **Cascade**: editing an artifact a previously approved gate relied on flips that gate to STALE and
  creates re-approval tasks (visible banner).
- **Autopilot** (Run Console): runs lifecycle agents stage by stage, pausing at every gate for a human.
  Speed control for demos (instant / 1 s per step / step-through).
- **Exports**: Evidence Pack (.docx), Data Contract (ODCS YAML), OpenLineage JSON, Audit bundle (.zip).
- **AC6.1** No code path other than `recordDecision()` approves a gate (invariant test).
- **AC6.2** Submitting for review is blocked while any agent proposal is unreviewed.
- **AC6.3** Applying the two certification fixes on the demo product then certifying makes it
  Certified in Marketplace and enables a previously-declined agent answer.
- **AC6.4** Changing a contract column after Stage 5 approval makes the Stage 5 gate STALE.

---

### M7 — Agent Factory (`/[pack]/factory`)

Build a new domain agent live.
1. **Purpose**: name, persona served, the decisions it supports (pick from pack decisions or type).
2. **Ground it**: choose certified products (non-certified shown disabled with reason); choose KPIs —
   the coverage matrix (KPI × grains × slices) is proposed automatically from products' semantic views.
3. **Instructions**: persona/response/guardrail/orchestration instructions drafted by the **Agent
   Designer** lifecycle agent (live or heuristic); human edits; out-of-scope list.
4. **Tools & budgets**: semantic query (per view), document search (per corpus), row limit, cost/answer
   budget, p95 latency budget.
5. **Evaluate**: runs eval suites — golden (generated from verified queries for chosen KPIs),
   boundary (out-of-scope questions), entitlement (persona probes), adversarial (injection set),
   groundedness. Scorecard with per-case drill-down.
6. **Publish gate**: 8 checks (ported from marketplace): manifest valid, products certified, coverage
   ⊆ product semantics, eval thresholds met, guardrails present, budgets set, owner + on-call set,
   human approval recorded. Blocking failures explain fixes.
7. **Release**: Pilot → Canary (x% of questions) → Production; rollback target retained.
- The new agent appears in Marketplace and Ask immediately (scripted mode uses coverage planner).
- **AC7.1** An agent bound to a non-certified product cannot pass the publish gate.
- **AC7.2** A factory-built agent answers ≥ 80% of its generated golden set correctly in scripted mode.

---

### M8 — Explorer (`/[pack]/explorer`)

Snowsight-inspired object browser over the pack database: tree (database → 9 schemas → objects by
type with icons), object page tabs: Preview (10–50 rows, persona policies applied, masked badge),
Columns (type, nullable, tags, term link, masking state), DDL (Snowflake dialect for display),
Lineage (upstream/downstream graph; column-level), Quality (DMF-style results), Governance (grants,
policies, tags, access history from `QueryLog`). **Worksheet**: SQL editor (CodeMirror) with pack
preset queries; read-only `SELECT` only, sql-safety guard, persona policies applied, results grid,
"Explain the result" (live mode) button.
- **AC8.1** The same object preview shows masked values for Persona B and clear values for Persona D.
- **AC8.2** Non-SELECT statements are rejected with a friendly message (no execution).

---

### M9 — Semantic & Knowledge (`/semantic`, `/glossary`, `/context`)

- **Semantic**: list of semantic views; detail = logical model diagram (tables + relationships),
  dimensions, time dimensions, facts, metrics (expr, synonyms, term link), verified queries; YAML tab
  (Snowflake semantic-view-compatible YAML export); **Playground**: pick metric(s), dimension, filter,
  grain → chart + generated SQL (via compiler) + "Ask an agent this".
- **Glossary**: terms with definition, formula, owner/steward, status, CDE flag, synonyms, mappings
  (term → columns → metrics → products → agents strip), DQ score.
- **Context**: agent instructions (versioned), business rules (BR-xxx with source doc), verified
  queries, synonyms, documents (search with highlighted chunks; simulated Cortex Search).
- **AC9.1** Playground value for each pack headline KPI equals the agent's golden answer.

---

### M10 — Run: Health, Agent Quality, Cost & Value, Impact, Audit

- **Health**: product health board (freshness, volume, DQ, schema), incidents list; **Break
  something** (pack incidents: late feed, null spike in CDE, duplicate load, schema drift, volume
  anomaly) → affected products turn Degraded, agents answering from them show incident banner and
  confidence drops; blast radius graph; Resolve → postmortem with time-to-detect/resolve.
- **Agent Quality**: eval scorecards per agent over time; feedback inbox (👎 from Ask); triage →
  fix type (add synonym, add business rule, add verified query, edit instruction) → re-run eval →
  delta shown (pack scripts the 88% → 94% moment). Fixes write versioned context entries.
- **Cost & Value**: illustrative credit/$ by layer, product, agent; per-answer token cost (live mode
  actuals); what-if levers (refresh lag, warehouse size, questions/day, credit price); **Value**
  tab: value cases per product (hypothesis, baseline, assumptions, measured), portfolio roll-up.
- **Impact**: pick a column/object → downstream blast radius (products, metrics, agents, consumers),
  severity, contract version bump suggestion and notice period, generated change plan.
- **Audit & Lineage**: append-only event stream (filter actor type human/agent, object, persona),
  full-estate lineage graph, export audit bundle.
- **AC10.1** Breaking the "late feed" incident changes the dependent agent's next answer banner to
  incident and confidence to Questionable; resolving restores Trusted.
- **AC10.2** Applying the scripted agent-quality fix raises the agent's eval by the pack-declared delta.

---

### M11 — Strategy: Platform Map, Why AI-Ready, Readiness, Roadmap, Portfolio, Operating Model

- **Platform Map**: nine-layer stack visual; animated flow replay (a record travels Bronze → Agent);
  click a layer → objects and "what breaks without it"; guided 5-step path.
- **Knockout**: 6 toggles (Silver, Gold, Semantic, Glossary, Context, Governance); 4 governed answers
  degrade with computed deltas, failure type (wrong/unsafe/ambiguous/unverified) and confidence.
  Implementation: knockout rewrites the MetricQuery path (e.g. without Semantic → naive SQL over Gold
  with pack-declared naive formula; without Context → business rule exclusions dropped; without
  Governance → masking off, flagged Unsafe).
- **Compare**: same question answered over raw Bronze vs governed stack, scorecard + SQL diff.
- **Readiness**: 21-question assessment (7 dimensions, weights, 5 bands, presets) — ported verbatim;
  radar, ranked gaps, recommended actions; client can fill live; save as named assessment.
- **Roadmap**: generate from readiness gaps → phases/workstreams Gantt with gates, "you are here".
- **Portfolio**: pipeline by phase, WSJF/RICE prioritisation with human override (ADPM), cost,
  adoption, value realised, 6-dimension maturity.
- **Operating Model**: RACI (9 roles × ~25 activities × 3 styles: centralised, hub-and-spoke, federated).
- **AC11.1** Turning off Context in Knockout changes the pack's flagged KPI by the declared delta.
- **AC11.2** Readiness scores for the three presets match the ported engine's unit-test fixtures.

---

### M12 — Admin (`/[pack]/admin`, Persona D or presenter)

Packs (installed, version, validation report), rubrics (thresholds), agent mode & model settings,
API key status (present/absent only), lifecycle agent autonomy (L0–L3, lower-only per workspace),
budgets, feature flags (hide modules), data scale (`S | M | L` rows), snapshot management, pack
drafter (M13).

### M13 — Pack Drafter (stretch, Phase 10)

Create a **Draft** pack for an industry/company not covered: inputs = industry, company archetype,
3–6 domains, 5–10 KPIs, regions. Live mode: LLM drafts pack YAML section by section (tool-constrained
to the pack schema), then the validator runs and a generator builds the warehouse; human reviews each
section (proposals, same provenance model). Offline: clone nearest deep pack and re-skin
(names/terms/regions). Draft packs show a "Draft" badge and are never used in scripted stories until
golden answers are approved.

## 5. Cross-cutting requirements

- **Consistency**: any number visible in two places must come from one compiled query (invariant 3).
- **Explainability**: every agent answer and every computed score has a "why" affordance.
- **Accessibility**: WCAG 2.2 AA; keyboard for all flows; reduced motion respected; charts have table fallback.
- **Performance**: TTI < 2 s on launch; scripted answer < 800 ms; live first token < 2 s, p95 complete
  < 10 s; Explorer preview < 300 ms on scale M; reset < 3 s.
- **Resilience**: no network required in scripted mode; LLM timeouts (12 s) → fallback.
- **Internationalisation**: English only in v1; all generic copy in `src/copy/en.ts`; number/date
  formats via `Intl` with pack locale.
- **Observability of the app itself**: structured logs (pino), `/api/health`, `/api/ready`.
