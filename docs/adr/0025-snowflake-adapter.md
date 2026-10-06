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
5. **Deploy as data, not transforms** (`pnpm snowflake:bundle --pack <id>`, `src/lib/warehouse/snowflake-deploy.ts`).
   - Every object of the built DuckDB warehouse (Bronze, Silver, Gold and the generated layers, views included) is exported to Parquet and loaded into a plain Snowflake table of the same name.
   - The bundle has `deploy.sql` (database, nine schemas, Parquet stage, `GOVERNANCE.AS_OF()` and the `MASK_*` SQL UDFs, `CREATE TABLE` / `PUT` / `COPY INTO` per object), `verify.sql` (expected against loaded row counts) and `manifest.json`. It runs with SnowSQL, because `PUT` is not available over the SQL API.
   - Snowflake therefore holds the exact rows the golden answers were recorded on, and the packs' DuckDB-dialect transforms (macros, `strftime`, list functions) never need translating.
   - The export uses the one DuckDB connection with file access (`exportParquet` in `duckdb.ts`), read-only and closed afterwards. Request-time connections keep external access disabled. Each file is read back and its row count checked.
   - All 11 packs bundle cleanly.
6. **Execution dialect** (`src/lib/query/dialect.ts`). QueryService rewrites only what the governed path emits, and only when the adapter is Snowflake:
   - `date_diff` → `DATEDIFF`, `quantile_cont` → `PERCENTILE_CONT … WITHIN GROUP`;
   - `hash` → `ABS(HASH)` in incident overlays, `INTERVAL (n) HOUR` → `INTERVAL 'n HOUR'`;
   - the information-schema name.

   Everything else (`SELECT * REPLACE/RENAME`, `DATE_TRUNC('unit', …)`, `COUNT_IF`, `MEDIAN`) means the same in both dialects. Identifiers: tables are created unquoted, and the adapter sets `QUOTED_IDENTIFIERS_IGNORE_CASE` and reports upper-case names in lower case.
7. **Still deferred (needs an account):**
   - running the bundle and the golden-agreement test against a real Snowflake;
   - native Snowflake masking and row-access policies (the governed path applies both itself);
   - the semantic view object;
   - Cortex Search.

   A pack becomes "Snowflake-verified" only after the golden-agreement run. Incident samples use Snowflake's `HASH`, so the rows a null-spike or duplicate-load incident touches differ from DuckDB's; scripted golden answers do not include incidents.

## Consequences
Offline test coverage:
- **Adapter** (`tests/unit/snowflake.test.ts`), against a mocked SQL API: JWT signature and claims, bindings, async polling, partitions, truncation, type conversion, identifier case, `describe`, errors and token reuse.
- **Dialect** (`tests/unit/snowflake-dialect.test.ts`): every metric of every pack, in four shapes (over 1,000 compiled queries), plus the incident overlays, comes out free of DuckDB-only constructs.
- **Bundle** (`tests/integration/snowflake-bundle.test.ts`): row counts equal the warehouse's, every object gets create, put and copy statements, and the output is byte-identical on rebuild.

Until a real-account run passes, the adapter stays labelled experimental in RUNNING.md and `.env.example`.
