# ADR-0025: Snowflake adapter over the SQL API (experimental)

Status: Accepted (post-Phase 11). The adapter is implemented and mock-tested; it has not been run against a real Snowflake account.

## Context
`12-deployment.md` §6 (Phase 11 stretch) asks for a `SnowflakeAdapter` behind `WarehouseAdapter`, plus a `pnpm snowflake:deploy` script that renders a pack into real Snowflake objects. The build environment has no Snowflake account or credentials. CLAUDE.md §3 asks for no new dependencies without approval.

## Decision
1. **SQL API v2 with key-pair auth.** `src/lib/warehouse/snowflake.ts` uses only `node:crypto` (RS256 JWT, public-key fingerprint) and `fetch`; there is no driver dependency.
   - Positional `?` parameters become SQL API `bindings`.
   - Asynchronous statements (202) are polled.
   - Further result partitions are read up to `maxRows`.
   - API errors become `SnowflakeError` carrying the SQL state.
2. **Same value conventions as the DuckDB adapter.**
   - Integers are numbers (strings beyond 2^53); decimals and floats are numbers.
   - DATE is `YYYY-MM-DD`, TIMESTAMP is `YYYY-MM-DD HH:MM:SS` (UTC); booleans are booleans.
   - Column types use the DuckDB names.

   Engines, grounding and formatting therefore need no changes.
3. **Selection.**
   - `WAREHOUSE_ADAPTER=snowflake` makes `warehouseFor()` (the only path, via QueryService) use the pack's `manifest.database` in Snowflake.
   - Settings come only through `snowflakeConfig()` in `env.ts`. The private key stays on disk and is never logged or sent to the browser, as with I11.
   - `/api/ready` reports configuration presence only.
4. **Auth timestamps.** JWT `iat`/`exp` need wall-clock time. They read `wallClockMs()` from `src/lib/config`, which is documented as for I/O only, so the determinism lint stays strict in the engine directories.
5. **Deferred:**
   - the deploy script (DDL, Parquet `PUT`/`COPY`, dynamic tables, policies, semantic view, Cortex Search);
   - compiler dialect switching;
   - the golden-agreement run against Snowflake.

   Compiled SQL is DuckDB dialect today, and some constructs may need Snowflake rewrites, for example the knockout `SELECT * REPLACE` projection and DuckDB date functions. A pack becomes "Snowflake-verified" only after the golden-agreement test passes against a real account.

## Consequences
- The adapter is unit-tested against a mocked SQL API (`tests/unit/snowflake.test.ts`). That covers JWT signature and claims, bindings, async polling, partitions, truncation, type conversion, `describe`, errors and token reuse.
- Running it for real needs an account, a deployed pack and the dialect work above. Until then it is labelled experimental in RUNNING.md and `.env.example`.
