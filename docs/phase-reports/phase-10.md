# Phase 10 — Industry expansion

Status: **complete**. Date: 2026-10-06. Phase 11 follows on.

## Built

| Deliverable | Where |
|---|---|
| **Insurance (deep)**: Sentinel Mutual. 6 domains, 7 views, 37 KPIs, 8 products, 5 agents, 28 scenarios. Hero: loss ratio excluding catastrophe losses (West leads); including them, South jumps on the August hurricane | `packs/insurance/` |
| **Telecom (deep)**: Altair Communications. 7 domains, 9 views, 34 KPIs, 28 scenarios. Hero: churn excluding inactive prepaid (West leads on a port-out wave) | `packs/telecom/` |
| **Manufacturing (deep)**: Forgepoint Industries. Business units stand in for regions; 8 views, 36 KPIs, 26 scenarios. Hero: OEE on production runs only; including trial runs reorders the units | `packs/manufacturing/` |
| **Public sector (deep)**: Westland County Services. 7 domains, 10 views, 37 KPIs, 28 scenarios. Hero: benefit processing days excluding document holds | `packs/public-sector/` |
| **Technology (standard)**: Cobalt Cloud Software. ARR, retention, pipeline, usage, support; 20 scenarios | `packs/technology/` |
| **Transportation (standard)**: Meridian Freight Lines. On-time delivery, fleet, safety, freight economics; 20 scenarios | `packs/transportation/` |
| **`_generic` (standard)**: Acme Holdings, a cross-industry back office (finance, working capital, workforce, customer); 16 scenarios | `packs/_generic/` |
| **Pack Drafter (M13)**:<br>• Offline re-skin of a deep pack: ids, company, HQ, regions, personas.<br>• Validator in the loop; depth `draft`; Draft badge on the launcher.<br>• Draft packs stay out of stories until their golden answers are recorded.<br>• Available as `pnpm pack:draft` and in Admin | `src/lib/packs/drafter.ts`, `src/lib/presenter/drafter.ts`, `scripts/pack-draft.ts` |
| **Engine guard rails** (ADR-0023):<br>• Standard-pack lifecycle demo rule.<br>• Validator checks verified-query counts on certified products.<br>• Grounding labels include metric units.<br>• Per-process build temp files.<br>• Seeding continues past a failing pack.<br>• Lint covers `_generic`.<br>• Platform Map path follows Silver-on-Silver lineage to Bronze. | `src/lib/packs/validate*`, `src/lib/agents/{eval,live/engine}.ts`, `src/lib/warehouse/build.ts`, `scripts/seed.ts`, `scripts/lint/no-domain-strings.ts`, `src/lib/strategy/platform.ts` |

Each pack was authored by its own agent against a shared brief, then integrated and re-verified here.

All packs follow the same pattern:
- They carry the same planted story roles: hero, rule-sensitive twin, cert demo (one warn + one fail, fixed by FIX-1/FIX-2), late-feed incident, knockout KPI and quality-fix synonym.
- Their agents decline all 15 shared adversarial probes with no query run.

## Definition of Done

| Check | Result |
|---|---|
| Validator green for all packs | ✅ `pnpm pack:validate` passes 0 errors on all 11 packs.<br>• Deep: banking 4,345, healthcare 4,624, insurance 4,814, manufacturing 5,090, public-sector 5,200, retail 4,594, telecom 4,816, utilities 4,550 checks.<br>• Standard: `_generic` 2,974, technology 2,898, transportation 2,993.<br>• The only warnings are 2 pre-existing ones on healthcare. |
| Golden green for all packs | ✅ `pnpm golden`: 0 differences on all 11 packs, 263 scenarios in total |
| Knockout declared deltas | ✅ `pnpm knockout:deltas` exits 0 for every pack |
| Stories green for all deep packs | ✅ All 6 stories on all 8 deep packs: 48 Playwright runs |
| Standard packs pass validator and S1/S5 | ✅ executive-5 and factory-10 on technology, transportation and `_generic`: 6 Playwright runs (54 story runs in total) |
| Eval harness | ✅ Every production agent of every deep and standard pack passes every suite (`eval-packs.test.ts`) |
| Seed | ✅ `pnpm db:setup` seeds all 11 packs; certified, in-certification, in-development and draft products land at their documented stages |

Totals:
- `pnpm test`: 41 files, 532 tests passing (540 with the Phase 11 surface tests).
- `pnpm test:e2e`: **321 passing**, including the axe sweeps (light and dark), stories and presenter.
- `pnpm lint`: clean, 0 domain-string violations across 11 packs and 1,249 terms. Typecheck and build are clean.

## Notes and decisions
- **ADR-0023:** the standard-pack lifecycle demo uses the in-certification product. Story e4 now says "drops out of Trusted", because every pack's Context knockout is a `wrong` failure, which scores Questionable.
- **Lint-safe naming:** pack objects that would become lint terms colliding with platform vocabulary were renamed inside the packs. Examples: `INSURANCE_POLICY`, `PLANT_SITE`, `OPERATOR_ROSTER`, `MOBILE_USAGE`, `GRANT_FUNDING`.
- **Known authoring friction** (documented for pack authors, not blocking):
  - A fixed-date plant needs an epoch-day number.
  - The matcher stems "loss" and "losses" differently.
  - `MetricFilter` has no `is not null`.
  - `rubrics.matcher.entity_nouns` lacks "resident" and "applicant".
