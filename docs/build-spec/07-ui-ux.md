# 07 — UI / UX Specification

## 1. Design principles

1. **Projector-first.** Readable at 1920×1080 from the back of a room: base font 15 px, numerals in
   tabular figures, minimum 4.5:1 contrast, no information conveyed by colour alone.
2. **Business words on the surface, engineering one click down.** Every screen leads with a sentence a
   VP understands; SQL/YAML/trace live in inspectors and tabs.
3. **Show the governance happening.** Policy chips, masked cells, certification seals, provenance badges
   and confidence labels are first-class visual elements, not footnotes.
4. **Calm motion with purpose.** Motion only to show flow (data moving through layers, trace steps
   completing, constellation links). Respect `prefers-reduced-motion`; presenter can disable.
5. **White-label by tokens.** No hard-coded colours; brand primary/accent drive the palette.

## 2. Visual system

- Base: shadcn/ui on Tailwind 4 with CSS variable tokens (port token naming from marketplace
  `portal/styles/tokens/*.css`). Light and dark themes; dark is default for projector mode toggle.
- Type: Inter (UI), JetBrains Mono (code/SQL), bundled locally.
- Semantic colours (fixed, not brand): `certified` (green), `in-certification` (amber),
  `draft` (slate), `degraded` (orange), `down/fail` (red), `agent` (violet — used for anything an agent
  produced), `human` (blue — human decisions). Layer colours: 9 fixed hues used consistently in
  Platform Map, lineage nodes and trace steps.
- Icons: lucide only; each layer, artifact type and agent family has a fixed icon.

## 3. Shell

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [logo] Northvale Energy · Keystone   [Pack ▾]   🔍 Search (/)    ⌘K   ●Scripted   [👤 Persona ▾] ⋯ │
├──────────┬──────────────────────────────────────────────────────────────────────────────┤
│ HOME     │                                                                              │
│ CONSUME  │                          page content                                        │
│ BUILD    │                                                                              │
│ RUN      │                                                                              │
│ STRATEGY │                                                                              │
├──────────┴──────────────────────────────────────────────────────────────────────────────┤
│ Story: Business 15′  ● ● ◉ ○ ○ ○   Step 3 · Certify DP-UTL-005   [◀] [Go] [▶]   ⏱ 06:12    │  ← story rail (presenter)
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
Persona switcher: popover with 5 persona cards (avatar, name, title, archetype badge, 1-line "what they
can see"); switching animates a toast "Now viewing as … — PII masked, North region only".

## 4. Key screen layouts

### 4.1 Ask an Agent
```
┌ Agents ─────────┐┌ Conversation ──────────────────────────────┐┌ Inspector ───────────────┐
│ ● Reliability   ││ You: What was SAIDI by region last quarter? ││ [Trace] SQL Sources Policy│
│ ○ Customer      ││ ┌ Answer ─────────────────── ●Scripted ──┐ ││ 1 Understand  ✓ 12ms     │
│ ○ Procurement   ││ │ East had the highest SAIDI … 142.3 min │ ││   SAIDI → GT-UTL-SAIDI   │
│ ○ Steward (pilot)││ │ [bar chart by region]                  │ ││ 2 Apply context ✓        │
│                 ││ │ table · masked cells •••               │ ││   BR-UTL-012 excl. MED   │
│ Suggested       ││ │ Sources: DP-UTL-002@2.1.0 ✓ · saidi ·  │ ││ 3 Choose model ✓         │
│  • SAIDI by …   ││ │ BR-UTL-012 · VQ-UTL-004   Trusted ✓    │ ││ 4 Check access ✓ (RAP)   │
│  • Worst feeders││ │ [by feeder] [last 4 qtrs] [why?]  👍 👎 │ ││ 5 Query 38ms · 5 rows    │
│                 ││ └────────────────────────────────────────┘ ││ 6 Ground DOC-…#3         │
│                 ││ [ Ask a question…                    ↵ ]   ││ 7 Answer ✓ citations ok  │
└─────────────────┘└────────────────────────────────────────────┘└──────────────────────────┘
```
Trace steps animate in sequence (~120 ms each in scripted mode; real timings in live mode).

### 4.2 Marketplace grid
Cards 3–4 per row; quality ring top-right; status chip top-left; access badge bottom; hover shows
"Ask its agent" and "Request". Left facet rail (collapsible). Top tabs: All · Data Products · Agents ·
Demand · Mesh.

### 4.3 Product Studio workspace
Left: vertical stage nav grouped by phase with gate icons (○ pending, ◐ in review, ● approved,
⚠ stale, ✕ rejected). Centre: artifact editor with field-level provenance chips. Right column, stacked:
Agent panel (Run / streaming narrative / proposals list), Exit criteria (✓/✕ with reasons), Gate
(roles, quorum meter, decisions, Submit/Approve/Reject). Top: product header with status, version,
"Autopilot" button, exports menu.

### 4.4 Platform Map
Nine horizontal bands stacked bottom (Bronze) to top (Agents), Governance as a vertical spine on the
right touching every band. Each band shows object counts and 3 representative objects; "Replay flow"
animates a single record (e.g. one outage event) lifting through bands and becoming a cited number in
an agent bubble at the top.

## 5. Component inventory (build in `src/components`)

| Area | Components |
|---|---|
| shell | AppShell, DoorNav, TopBar, PersonaSwitcher, PackSwitcher, ModeBadge, CommandPalette, GlobalSearch, StoryRail, PresenterMenu, Spotlight, Toaster |
| primitives | StatusChip, CertifiedSeal, QualityRing, FreshnessPill, SensitivityChip, AccessBadge, ConfidenceLabel, ProvenanceBadge, LayerBadge, KpiTile (value, target band, sparkline), Stat, EmptyState, CodeBlock (SQL/YAML highlight), DataGrid (virtualised, masked cell renderer), Drawer, Tabs |
| charts (Recharts) | BarChart, LineChart, Sparkline, Radar (readiness), Gantt (roadmap), Heatmap (coverage), Waterfall (knockout deltas) — every chart has "view as table" |
| graph (@xyflow) | LineageGraph (object & column level), MeshGraph, BlastRadiusGraph, Constellation (force layout, d3-force), LayerFlow |
| answer | AnswerCard, TraceRail, SqlTab, SourcesTab, PolicyTab, RefusalPanel, ClarifyChips, FollowupChips, FeedbackControl |
| lifecycle | StageNav, ArtifactEditor (schema-driven from Zod registry), ProposalList, CriticComment, ExitCriteria, GatePanel, CertChecklist, AutopilotBar, DiffView |
| marketplace | ProductCard, AgentCard, FacetRail, CompareTable, AccessRequestDrawer, PolicyPreview, DemandBoard, CoverageMatrix |
| operate | IncidentCard, HealthBoard, EvalScorecard, FeedbackInbox, CostLevers, ImpactPlan, AuditStream |
| strategy | ReadinessForm, ReadinessRadar, GapList, RoadmapGantt, KnockoutPanel, CompareSplit, RaciMatrix, PortfolioBoard |

## 6. Empty, loading, error states

- Skeletons for every async panel; never a spinner alone > 400 ms.
- Errors render as a calm card with what happened, what still works, and a "Reset this view" action;
  stack traces only in dev. Agent failures never surface raw errors (fallback per invariant).

## 7. Accessibility

WCAG 2.2 AA: focus visible, keyboard paths for persona switch, ask, approve, certify, story Go;
`aria-live=polite` for streamed answers and trace; colour pairs validated; charts with table
alternatives; all graphs keyboard-navigable (tab through nodes, Enter to open). Axe checks in CI on
every route for every deep pack.

## 8. Keyboard shortcuts

`/` search · `Ctrl/⌘+K` palette · `Ctrl+Shift+P` persona · `Shift+P` presenter overlay · `→`/`←` story
next/prev · `G` story Go · `Shift+R` reset (confirm) · `Shift+B` break something · `Shift+S` show SQL everywhere.
