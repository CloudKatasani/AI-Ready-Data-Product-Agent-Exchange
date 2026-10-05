# Claude Code Kickoff Prompt — Keystone

> **How to use this.** Create an empty directory. Copy `CLAUDE.md`, the whole `docs/` folder and `packs/_shared/` from
> this spec pack into it. Clone the three predecessor repos as siblings under `../reference/` (read-only):
> `AI-Ready-Data-Platform-Demo`, `AgenticDataProductManagement`, `Enterprise-Data-Product-AI-Agent-Marketplace`.
> Paste everything below the line into Claude Code. Work **phase by phase**; do not one-shot.

---

`CLAUDE.md` is in the repo root and is binding. Read it first, then read every file in
`docs/build-spec/` in numeric order before writing code. If anything conflicts, stop and flag it.

## What we are building

**Keystone** — a cross-industry customer-demo application that shows raw data becoming governed data
products, those products powering AI agents that give cited, policy-checked answers, and the whole
estate being operated and improved. It merges three predecessor prototypes (read-only references in
`../reference/`); `docs/build-spec/00-source-review.md` §5 tells you exactly which files to port.

Three promises define success: **Agents act, humans decide. Every number is earned. The demo never breaks.**

## How to work

1. Follow `docs/build-spec/11-build-plan.md`. Start with **Phase 0**. At the end of each phase:
   run that phase's DoD checks, write `docs/phase-reports/phase-N.md` (built, deviations, tests,
   screenshots), and **stop and wait** for my "continue".
2. Port before you invent. When porting Python (marketplace) to TypeScript, keep behaviour and bring the
   original test cases across as fixtures. When porting ADPM/AI-Ready TypeScript, bring their tests.
3. Write the invariant test before the code it protects.
4. Content lives in `packs/`. If you find yourself typing an industry word in `src/`, stop — it belongs in a pack.
5. Every number on screen comes from `QueryService` via the metric compiler. No hard-coded figures.
6. Scripted mode must work with no network and no API key at every phase.
7. Record decisions in `docs/adr/`. Keep `docs/RUNNING.md` current.
8. Ask me before: adding a dependency not in CLAUDE.md §3, changing a pack schema field after Phase 1,
   or relaxing any threshold in `packs/_shared/rubrics.yaml`.

## Phase 0 — begin now

Execute Phase 0 from `docs/build-spec/11-build-plan.md`:
- scaffold the stack exactly as CLAUDE.md §3; layout per CLAUDE.md §6;
- AppShell with door navigation and stub pages for every route in `01-functional-spec.md` §3;
- placeholder invariant tests I01–I11 (marked `todo`) naming the assertion each will make;
- CI workflow, `.env.example` from `02-architecture.md` §6, ADR-0001…0008;
- `docs/RUNNING.md`.

Then report and stop.

## Later phase prompts (paste when I say "continue")

- **Phase 1:** "Execute Phase 1. Convert the utilities pack using 04 §8, sourcing from all three reference repos. Show me the validator report and three sample Gold tables (10 rows each) before you finish."
- **Phase 2:** "Execute Phase 2. Demonstrate in the report: one object previewed as personas B and D (masked vs clear), and the Playground value for SAIDI by region with its display SQL."
- **Phase 3:** "Execute Phase 3. Include the golden diff report and five Ask transcripts (answer, decline, clarify, redirect, help)."
- **Phase 4:** "Execute Phase 4. Walk AC3.1 end to end in the report with screenshots."
- **Phase 5:** "Execute Phase 5. Port ADPM lifecycle with tests first; show the cert demo product going from warn/fail to Certified, and the cascade-to-STALE case."
- **Phase 6:** "Execute Phase 6. If ANTHROPIC_API_KEY is set, run live eval for utilities and attach the agreement report. Convert banking, healthcare, retail."
- **Phase 7–11:** "Execute Phase N per the build plan."
