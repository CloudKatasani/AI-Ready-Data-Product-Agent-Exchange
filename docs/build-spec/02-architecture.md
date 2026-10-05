# 02 — Architecture

## 1. System context

```
┌──────────────────────────── Browser (presenter laptop / client screen) ────────────────────────────┐
│  Next.js RSC pages + client islands (charts, graphs, chat, editors)    SSE: answers, ticker, autopilot │
└───────────────▲──────────────────────────────────────────────────────────────▲───────────────────────┘
                │ Server Actions / Route Handlers                              │
┌───────────────┴──────────────────────── Next.js server (Node 22) ────────────┴───────────────────────┐
│  Pack Registry ── loads/validates packs/<id> (Zod) ── in-memory, hot-reload in dev                    │
│                                                                                                       │
│  Services:  QueryService ─▶ Policy Engine ─▶ WarehouseAdapter (DuckDB | Snowflake*)                   │
│             Metric Compiler (semantic view + MetricQuery → SQL)                                       │
│             Agent Runtime ── Scripted engine (matcher, planner) │ Live engine (Anthropic tools loop)   │
│                           └─ Grounding validator ─ Answer recorder ─ Eval harness ─ Publish gate      │
│             Lifecycle Engine (stages, gates, cascade, artifacts, lifecycle agents, autopilot)         │
│             Marketplace (catalog, search, mesh, access workflow, demand, value)                       │
│             Operate (health/incidents, quality scoring, cost, impact) · Strategy (readiness, …)       │
│             Presenter (profiles, stories, reset/snapshots, branding)                                  │
│  Persistence: Prisma ─▶ SQLite (default) | Postgres        Warehouse files: data/warehouse/*.duckdb   │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
        ▲ optional                                     ▲ optional
   Anthropic API (live agents, lifecycle agents)   Snowflake SQL API (* Phase 11)
```

## 2. Key design decisions (create these ADRs in `docs/adr/`)

| ADR | Decision | Rationale |
|---|---|---|
| 0001 | Single TypeScript/Next.js codebase | Removes Python/TS split; one deployable; Claude Code productivity |
| 0002 | DuckDB as the demo warehouse | Real SQL executes in-process; fast; file snapshot = instant reset; dialect close enough to Snowflake for display translation |
| 0003 | Declarative packs (YAML + SQL + MD), no TS per pack | New industries are content, not code; validator can check everything; LLM drafter can author them |
| 0004 | MetricQuery as the single intermediate representation | Scripted scenarios, LLM tool calls, playground, knockout and KPI tiles all compile through one function ⇒ consistent numbers |
| 0005 | Dual-mode agent runtime (scripted / live / auto) | Determinism for demos, real AI when available, graceful fallback |
| 0006 | Persona-based demo auth | Persona switching is the demo; real auth is out of scope for v1 |
| 0007 | Snapshot-based reset | Copy pristine SQLite + DuckDB files per profile; < 3 s |
| 0008 | Agents never approve | Inherited from ADPM; enforced by single approval path and tests |

## 3. Module boundaries

```
src/lib/
  packs/        → depends on nothing in lib (pure load/validate)
  warehouse/    → packs
  query/        → warehouse, packs, (prisma for QueryLog, live incidents, entitlements)
  agents/       → query, packs, prisma
  lifecycle/    → query (profiling, DQ), agents (lifecycle agents), prisma
  marketplace/  → query, agents, lifecycle, prisma
  operate/      → query, agents, marketplace, prisma
  strategy/     → packs, query (knockout/compare), lifecycle (coverage)
  presenter/    → everything (orchestration only)
```
Rule: UI calls services via Server Actions or Route Handlers only; services never import React.
`eslint-plugin-boundaries` enforces the dependency direction.

## 4. Core interfaces (TypeScript signatures to implement)

```ts
// src/lib/warehouse/adapter.ts
export interface WarehouseAdapter {
  dialect: 'duckdb' | 'snowflake';
  query(sql: string, params?: unknown[], opts?: { timeoutMs?: number; maxRows?: number }): Promise<QueryResult>;
  describe(fqn: string): Promise<ColumnInfo[]>;
  close(): Promise<void>;
}
export interface QueryResult { columns: { name: string; type: string }[]; rows: unknown[][]; rowCount: number; elapsedMs: number; truncated: boolean }

// src/lib/query/query-service.ts
export type QueryRequest =
  | { kind: 'preview'; fqn: string; limit?: number }
  | { kind: 'sql'; sql: string; source: 'worksheet' | 'profiling' | 'dq-rule' }
  | { kind: 'metric'; query: MetricQuery; purpose: 'agent' | 'playground' | 'kpi-tile' | 'knockout' | 'eval' };
export interface Principal { personaId: string; roles: Role[]; rowFilters: RowFilter[]; unmasked: SensitiveClass[]; entitlements: string[] /* product ids */ }
export interface GovernedResult extends QueryResult {
  sql: string;               // the SQL actually executed (after policy rewrite)
  displaySql: string;        // Snowflake-dialect rendering for UI
  policiesApplied: PolicyApplication[]; // masking, row access, entitlement, incident
  maskedColumns: string[];
  rowFiltered: boolean;
  sources: { productId: string; version: string; certified: boolean; health: 'healthy'|'degraded'|'down' }[];
  queryLogId: string;
}
export interface QueryService { run(req: QueryRequest, who: Principal, ctx?: { knockout?: LayerId[] }): Promise<GovernedResult> }

// src/lib/query/compiler.ts
export interface MetricQuery {
  view: string;                       // semantic view name
  metrics: string[];                  // metric names in that view
  dimensions?: string[];              // dimension names
  timeGrain?: 'day'|'week'|'month'|'quarter'|'year';
  timeRange?: { from?: string; to?: string; last?: { n: number; unit: 'day'|'month'|'quarter'|'year' } };
  filters?: { dimension: string; op: '='|'!='|'in'|'not in'|'>'|'<'|'between'; value: unknown }[];
  orderBy?: { field: string; dir: 'asc'|'desc' }[];
  limit?: number;                     // default 50, max from rubric
  analysis?: 'value'|'trend'|'rank'|'contribution'|'distribution'|'compare_target';
}
export function compileMetricQuery(q: MetricQuery, pack: Pack, opts?: { knockout?: LayerId[] }): CompiledQuery; // { sql, fqnsTouched, productIds, metricRefs, ruleRefs }
```

## 5. Request flows

### 5.1 Scripted answer
1. `POST /api/ask` (SSE) `{agentId, question, mode:'scripted'}`.
2. `scripted/respond.ts`: normalise → synonym expansion (pack synonyms + glossary) → TF-IDF match over
   this agent's scenarios (thresholds from rubric: run ≥ 0.45, clarify 0.25–0.45). If no scenario
   matches, **coverage planner** tries KPI-name/synonym match within the agent's `kpi_coverage` and
   builds a MetricQuery from analysis depth + detected slice/grain words.
3. Guardrails: out-of-scope keywords → decline; product not entitled → decline + request; not
   certified → banner; better agent → redirect.
4. `QueryService.run({kind:'metric'})` → policies → DuckDB → GovernedResult.
5. Compose answer from scenario `answer` template (Mustache-style with formatted result fields) or
   planner templates; build trace; record `AnswerRecord`; stream events: `trace-step`, `answer`, `done`.

### 5.2 Live answer (tool loop)
1. Build system prompt = agent instructions (pack) + guardrail block + citation contract + coverage
   summary; tools = agent's bound tools (see `08-agents-llm.md`).
2. Loop (max 6 tool rounds): model → tool_use → validate args (Zod) → execute via QueryService/search
   → tool_result (compact JSON, ≤ 4 KB) → model. Stream text deltas and trace steps.
3. Model must end with a final `submit_answer` tool call (structured: headline, narrative,
   citations[], chart hint, followups). Free text without `submit_answer` = invalid.
4. Grounding validator checks numbers/citations against tool results. Fail ⇒ one repair turn ⇒ fail
   again ⇒ scripted fallback with `fallbackReason`.
5. `auto` mode: start live; on missing key, timeout, budget exceeded or grounding failure → scripted.

### 5.3 Lifecycle stage agent
`runLifecycleAgent(productId, stage, agentId)` → scope artifacts → redaction → provider
(live: Anthropic structured output tool `propose`; offline: ported heuristics) → persist `AgentAction`
+ `AgentProposal[]` → UI renders accept/edit/reject → human acceptance writes new `ArtifactVersion`
with field provenance.

### 5.4 Reset
Profile start state = `data/snapshots/<profileId>/{app.db, <pack>.duckdb}` created at profile save.
Reset: close connections → copy files → reopen → bump `demoEpoch` (clients refetch via SSE event).
Postgres mode: `TRUNCATE` + `COPY FROM` snapshot dump per profile (slower; target < 8 s).

## 6. Configuration (`.env.example`)

```
DATABASE_PROVIDER=sqlite                 # sqlite | postgresql
DATABASE_URL=file:./data/keystone.db
WAREHOUSE_ADAPTER=duckdb                 # duckdb | snowflake (Phase 11)
WAREHOUSE_DIR=./data/warehouse
DEMO_SCALE=M                             # S (≈50K rows/pack) | M (≈500K) | L (≈5M)
AGENT_MODE_DEFAULT=scripted              # scripted | auto | live
ANTHROPIC_API_KEY=
KEYSTONE_MODEL_ANSWER=claude-sonnet-5-5  # domain agent answers
KEYSTONE_MODEL_LIFECYCLE=claude-sonnet-5-5
KEYSTONE_MODEL_FAST=claude-haiku-4-5-20251001  # routing, classification, follow-ups
KEYSTONE_MODEL_DRAFTER=claude-opus-5-5   # pack drafter (stretch)
LLM_TIMEOUT_MS=12000
LLM_MAX_TOOL_ROUNDS=6
LLM_BUDGET_USD_PER_SESSION=5
SESSION_SECRET=change-me                 # signs persona cookie; app refuses to start in production with default
SNOWFLAKE_ACCOUNT= SNOWFLAKE_USER= SNOWFLAKE_PRIVATE_KEY_PATH= SNOWFLAKE_WAREHOUSE= SNOWFLAKE_ROLE=
```
Model IDs are configuration, never literals in code. Prices for cost display live in
`packs/_shared/rubrics.yaml#llmPricing` and are labelled illustrative.

## 7. Security posture (demo-appropriate)

- Persona cookie: HMAC-signed, httpOnly, sameSite=lax. Personas are not security; the policy engine
  still enforces everything server-side so the governance story is real.
- Worksheet SQL: parsed with a SQL allow-list (single `SELECT`/`WITH`; no `COPY`, `ATTACH`,
  `INSTALL`, `PRAGMA`, file functions like `read_csv`/`read_parquet`, no `;` chaining); DuckDB opened
  with `enable_external_access=false`, `lock_configuration=true`.
- LLM tools never receive raw SQL authority — they submit MetricQuery JSON or document-search terms.
- Uploaded logos sanitised (SVG via DOMPurify server-side; size cap).
- CSP: default-src 'self'; no third-party scripts; fonts bundled.

## 8. Deployment targets

1. **Laptop**: `pnpm i && pnpm demo` → builds warehouses for installed packs (cached), seeds, starts on :3000.
2. **Docker**: multi-stage image (~250 MB) with pre-built warehouses for deep packs; `docker run -p 3000:3000 -e ANTHROPIC_API_KEY=… keystone`.
3. **Shared demo server**: docker-compose with Postgres, behind company SSO proxy; `AUTH_MODE=proxy`
   reads presenter identity from header (stretch).
Cloud reference notes (AWS App Runner / Azure Container Apps / GCP Cloud Run) in `12-deployment.md`.
