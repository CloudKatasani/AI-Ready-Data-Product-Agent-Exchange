# ADR-0023: Standard-pack rules and pack-authoring guard rails

Status: Accepted (Phase 10)

## Context
Phase 10 added four deep packs (insurance, telecom, manufacturing, public-sector) and three standard packs (technology, transportation, `_generic`). Authoring them exposed six gaps in the engine:

1. The validator required `lifecycleDemoProduct` to be IN_DEVELOPMENT, but the standard-pack quota (3 Certified + 1 In certification) leaves no such product. No standard pack could reach 0 errors.
2. Executive story step e4 promised "confidence drops to Unsafe" when Context is switched off. Every pack declares that failure as `wrong`, which scores Questionable, so no pack could show Unsafe.
3. The seed refuses to certify a product with fewer than `rubrics.certification.min_verified_queries` active verified queries on its view. The validator did not check this, so authors only found out when seeding failed.
4. A metric unit containing digits (for example "per 1,000 units") failed the groundedness suite, because the scripted headline inlines the unit.
5. Concurrent warehouse builds shared one temp file and could leave a half-built warehouse. Seeding stopped at the first failing pack.
6. The domain-string lint skipped every `_`-prefixed folder, so `_generic`'s terms were never checked.

## Decision
1. A **standard** pack's lifecycle demo may be its IN_CERTIFICATION product. Deep packs still need an IN_DEVELOPMENT product with open proposals.
2. Story e4 expects `confidence: notTrusted` and says the badge "drops out of Trusted". The Playwright story spec already asserted "not trusted".
3. Validator category 3 checks that every CERTIFIED product has at least `min_verified_queries` active verified queries on its semantic view.
4. Grounding labels include KPI and metric units, in both the eval and live engines. As with other labels, digits inside a unit are not treated as claims.
5. Builds write to a per-process temp file and clean up on failure. `pnpm db:seed` seeds every pack it can, then exits non-zero naming the ones that failed.
6. The lint covers every folder that has a `pack.yaml`. That includes `_generic` and excludes `_shared` and `_schema`.
7. **Test coverage of standard packs:**
   - The eval harness and story-resolution tests run on deep and standard packs.
   - Playwright runs all six stories on deep packs, and S1 (executive-5) and S5 (factory-10) on standard packs, which is the Phase 10 DoD.

## Consequences
Every pack now reaches 0 validator errors. Authoring mistakes that used to show up only when seeding now show up in `pnpm pack:validate`.
