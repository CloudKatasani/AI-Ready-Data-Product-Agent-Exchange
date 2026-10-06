# Phase 9 — Presenter & stories

Status: **complete**. Date: 2026-10-06. Phase 10 follows on.

## Built

| Deliverable | Where |
|---|---|
| **Demo Profiles**:<br>• Pack, brand (product name, company display name, PNG/SVG logo ≤ 200 KB, primary/accent), display-only terminology overrides limited to the pack's `overridable` list, story, agent mode, kiosk lock.<br>• Persisted in `DemoProfile`; archived, never deleted.<br>• Export/import as `.keystone-profile.json` (no secrets).<br>• Snapshot taken on save. | `src/lib/presenter/profiles.ts`, migration `20261006080000_phase9_presenter`, `/api/profile/:id` |
| **Brand contrast guard**: WCAG AA (white or ink text). A failing colour gets a deterministic same-hue accessible alternative, shown live in the form and returned on save | `src/lib/presenter/branding.ts` (`checkBrand`, `accessibleAlternative`) |
| **Launcher**: industry cards → profile setup (live contrast check, terminology, story, agent mode — Live is disabled without a key — and kiosk lock); saved profiles (launch, duplicate, export, archive); import.<br>Launch sets the profile and story-start persona cookies and lands on Home. Kiosk-locked profiles skip the launcher | `src/app/(presenter)/launch/*`, `src/components/presenter/profile-form.tsx` |
| **Branding applied**: CSS tokens, product/company name and logo in the top bar. Display-only terminology pass over the page | `src/app/[pack]/layout.tsx`, `top-bar.tsx`, `src/components/presenter/terms.tsx` |
| **Snapshot reset** (ADR-0021):<br>• `VACUUM INTO` snapshots.<br>• In-place restore of every table except profiles and migrations, in one transaction — about 90 ms.<br>• Checkpoints per story step.<br>• SQLite pinned to one pooled connection. | `src/lib/presenter/reset.ts`, `src/lib/db/index.ts` |
| **Story engine**:<br>• The six shared stories resolved per pack: `{{persona.X.*}}`, `{{company.*}}` and `{{roles.*}}` placeholders, plus per-pack cue overrides.<br>• Each step's `go` becomes a concrete URL in its documented state (route, product, stage, tab, view, preset, KPI, incident, persona). | `src/lib/presenter/stories.ts` |
| **Presenter overlay** (Shift+P):<br>• Story picker and rail with Go.<br>• Cue card (do / say) with next-step preview; step and total timers against the story length.<br>• Reset demo with confirmation; Break something / Fix it.<br>• Spotlight when a step names a target; leave-behind mode.<br>• Printable cue cards; Shift+→ / Shift+← shortcuts.<br>• Go sets the persona, takes or restores the checkpoint, then navigates. | `src/components/presenter/presenter-overlay.tsx`, `src/app/[pack]/presenter-actions.ts`, `/[pack]/story/<id>` |
| **Pages honour Go state**:<br>• Knockout highlights the story's KPI and keeps it across recomputes.<br>• Platform Map autoplays the flow.<br>• Health highlights the story incident.<br>• Roadmap takes a preset and has a **coverage heatmap with Simulate +4 weeks** (ported, per Bronze source, levels 0–6). | `(strategist)/*`, `(operator)/health`, `src/lib/strategy/coverage.ts` |
| **Admin**: packs, rubric thresholds, agent mode and model settings, API key **present/absent only**, budgets, data scale, snapshots | `(presenter)/admin` |

## Definition of Done

| Check | Result |
|---|---|
| **AC1.1**: launching a profile lands on `/[pack]/home` in < 2 s with branding applied | ✅ e2e: save a branded profile → Launch → Home. Under 2 s from click; the company name is in the top bar, `--brand-primary` equals the chosen colour, and the story's first-step persona is active |
| **AC1.2**: brand colours failing AA are rejected with a suggested accessible alternative | ✅ Integration (the suggestion is verified ≥ 4.5:1) and e2e (live "Fails WCAG AA — try #…", rejected on save) |
| **AC1.3**: profiles persist across server restart | ✅ Integration: a brand-new Prisma client reads the profile back. e2e: profiles are listed after reload |
| **AC1.4**: reset restores the profile's starting state in < 3 s, keeping profile and branding | ✅ Invariant **I09** (no longer `todo`): an incident and changed rows are restored exactly, the audit count matches, and reset is under `rubrics.demo.reset_target_ms`. Checkpoints rewind; profile and brand survive. e2e: break → overlay Reset → under 3 s, the incident is gone and the branding remains |
| **AC1.5**: every story step's Go produces the documented state | ✅ `tests/stories/stories.spec.ts`, **6 stories × 4 deep packs (24 runs)**. Every Go lands on the step's route with every state parameter as the step's persona; the rail shows the step. Landing-observable expectations are asserted: layers 9, band and gaps, phases, RACI, maturity, Simulate +4 weeks, hero answer kind and row filter, knockout delta and confidence, contract bump, cost per answer |
| All 6 stories green on 4 deep packs | ✅ The 24 story runs above. Expectations that need the presenter's own clicks first are covered on the feature suites (see below) |
| Reset < 3 s | ✅ About 90 ms on the utilities estate (I09 asserts the rubric target) |

Expectations that need the step's clicks first are covered elsewhere:

| Expectation | Covered by |
|---|---|
| certified, version 1.0.0 | AC6.3 integration + e2e |
| access GRANTED | AC3.x integration + e2e |
| cites product | AC6.3 integration |
| product health DEGRADED, agent banner | AC10.1, all four packs |
| override recorded | Phase 8 integration + e2e |
| coverage proposed, eval passed, publish gate | AC7.x integration + e2e |
| duplicate suggested, stage 1 | AC5.x |
| submit blocked, gate stale | AC6.2 / AC6.4 |
| agent approvals 0 | I04 / I05 |
| same number scripted (live) | AC4.2 with the fake client |

Totals:
- `pnpm test`: 37 files, 442 tests passing, **0 `todo`**. I01, I08, I10 and I11 placeholders are now real tests.
- `pnpm test:e2e`: **216 passing** across three Playwright projects. `chromium` (features and axe) runs first, then `stories` (24 story runs), then `presenter` (launch and reset, which rewrite the DB).
- Lint, typecheck and build are clean.

## Notes and decisions
- **ADR-0021**:
  - Reset is an in-place table copy (no file swap, no reconnect). The warehouse is read-only at runtime, so it needs no restore.
  - SQLite runs with one pooled connection.
  - Story step `p7` (Build Guide, a vendor-tooling runbook not part of Keystone) became the Platform Map walk-through; `i6` points at Portfolio's maturity.
  - Story PDF is a printable cue-card page.
  - Profile scoping of runtime models (several presenters on one server) is deferred.
- **Terminology overrides are display-only**: a client-side pass over `#main` text, including display SQL, so numbers stay consistent. Form inputs and `data-no-terms` regions are untouched.
- **Test isolation**:
  - Tests that reset use a private `VACUUM INTO` copy of the test DB.
  - The Playwright `presenter` project runs after everything else.
  - The e2e web server now builds every pack's warehouse (content-hash cached).
