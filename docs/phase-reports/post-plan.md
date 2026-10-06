# After the build plan: follow-ups

Date: 2026-10-06. Work done after Phase 11, at the user's request. Every item is on `main`. CI run #7 failed on a test-ordering flake in I09: the copied state could already hold the incident the test opens. The test now picks an incident template that is not already open. CI run #8 on `2a6f92e` is green: checks, E2E, a11y, stories, and the Docker image under budget.

| Change | Decision | Verification |
|---|---|---|
| **Docker image under budget**:<br>• Distroless Node 22 runtime.<br>• Node entrypoint, gzipped template DB, no duplicate `packs/`.<br>• CI fails the build above 300 MB. | ADR-0022 (amended) | CI: **278 MB** (was 371 MB). The container serves a pack page 8.7 s after `docker run`, including warehouse autobuild. |
| **Fixed standalone crash**: `outputFileTracingExcludes` matched `next/dist/lib/metadata`. Data is now excluded by file extension. | — | CI smoke test (health, plus a rendered pack page) |
| **Pack-authoring fixes**:<br>• ISO dates in plants.<br>• `is null` / `is not null` filters.<br>• Stemmer keeps "loss" = "losses".<br>• Entity nouns "resident" and "applicant". | ADR-0023 §8 | Golden, validator, knockout and eval unchanged for all 11 packs |
| **One app DB per Demo Profile** (shared server, several presenters):<br>• Each profile's database is chosen from the signed profile cookie.<br>• Reset and checkpoints are scoped to the profile. | ADR-0024, a deliberate deviation from 12 §4's `profileId` columns | Isolation test; I09; 321 e2e |
| **Product renamed** to "Enterprise AI Ready - Data Products & Agents Platform". The `keystone` codename stays in internal identifiers. | CLAUDE.md header | 321 e2e |
| **Snowflake** (experimental):<br>• SQL API adapter with key-pair JWT.<br>• `pnpm snowflake:bundle`: deploy as data (Parquet, `deploy.sql`, `verify.sql`).<br>• Execution dialect in QueryService.<br>• `pnpm snowflake:golden` agreement run. | ADR-0025 | Mocked SQL API tests. Over 1,000 compiled queries are Snowflake-clean. Bundle row counts match. Golden answers are unchanged through the translated path for all 11 packs. |

## What only an account holder can do
1. `pnpm snowflake:bundle --pack <id>`, then `cd data/snowflake/<id> && snowsql -f deploy.sql && snowsql -f verify.sql`. Every `ok` should be TRUE.
2. Set the `SNOWFLAKE_*` settings and run `pnpm snowflake:golden --pack <id>`. 0 differences marks the pack Snowflake-verified.
3. Optional: native Snowflake masking and row-access policies, a semantic view object and Cortex Search. These are not needed by the app, because the governed path applies policies itself.

Totals at this point:
- `pnpm test`: 573 passing, 91% line coverage of `src/lib`.
- `pnpm test:e2e`: 321 passing.
- Lint, typecheck and build are clean.
