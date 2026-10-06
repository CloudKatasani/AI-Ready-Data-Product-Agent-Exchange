/**
 * QueryService (02 §4, invariant I02) — the ONE governed path for every row of warehouse data:
 * compile → entitlement → row access → masking → (incident effects, Phase 7) → limits → execute → log.
 */
import { createHash } from 'node:crypto';
import type { IncidentTemplate, Pack } from '@/lib/packs/schema';
import type { Rubrics } from '@/lib/packs/schema';
import type { CellValue, WarehouseAdapter } from '@/lib/warehouse/adapter';
import { compileMetricQuery } from './compiler';
import { toDisplaySql } from './display-sql';
import { type ColumnInfo, IncidentBlocked, incidentSource, openTemplates, productHealth } from './incidents';
import { checkEntitlement, EMPTY_STATE, governedSource, maskFor, type PolicyState, productsForObject, rowFilterFor } from './policies';
import { checkWorksheetSql, rewriteTables } from './sql-safety';
import type { GovernedResult, OutputField, PolicyApplication, Principal, QueryRequest, ResultSource } from './types';

export interface QueryLogEntry {
  personaId: string;
  kind: QueryRequest['kind'];
  purpose: string | null;
  sqlHash: string;
  displaySql: string;
  productIds: string[];
  policies: PolicyApplication[];
  rowCount: number;
  elapsedMs: number;
}

/** Append-only sink for QueryLog rows (Prisma in the app, in-memory in tests). */
export interface QueryLogSink {
  write(entry: QueryLogEntry): Promise<string>;
}

export interface QueryServiceDeps {
  pack: Pack;
  rubrics: Rubrics;
  warehouse: WarehouseAdapter;
  log: QueryLogSink;
  state?: PolicyState;
}

export class SqlRejected extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
    this.name = 'SqlRejected';
  }
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export class QueryService {
  private columnsCache = new Map<string, ColumnInfo[]>();
  private objectsCache: Set<string> | null = null;

  constructor(private readonly deps: QueryServiceDeps) {}

  /** Live status/version of a product (lifecycle state when known, else the pack's initial values). */
  productState(productId: string): { status: string; version: string } {
    const p = this.deps.pack.products.find((x) => x.id === productId);
    return this.state.products?.[productId] ?? { status: p?.initial_status ?? 'DRAFT', version: p?.version ?? '0.0.0' };
  }

  private get state(): PolicyState {
    return this.deps.state ?? EMPTY_STATE;
  }

  private async columnInfo(fqn: string): Promise<ColumnInfo[]> {
    let cols = this.columnsCache.get(fqn);
    if (!cols) {
      cols = (await this.deps.warehouse.describe(fqn)).map((c) => ({ name: c.name, type: c.type }));
      this.columnsCache.set(fqn, cols);
    }
    return cols;
  }

  /** Base object, or its incident overlay while an open incident targets it; column names after any rename. */
  private async overlay(fqn: string): Promise<{ sql: string; columns: string[]; applied: PolicyApplication[]; renamed: { from: string; to: string; incidentId: string }[] }> {
    const info = await this.columnInfo(fqn);
    const o = incidentSource(fqn, fqn, info, this.incidents);
    const rename = new Map(o.renamed.map((r) => [r.from, r.to]));
    return { ...o, columns: info.map((c) => rename.get(c.name) ?? c.name) };
  }

  private get incidents(): IncidentTemplate[] {
    return openTemplates(this.deps.pack, this.state.incidents);
  }

  /** Every queryable object (schema-qualified) in the warehouse. */
  async objects(): Promise<Set<string>> {
    if (!this.objectsCache) {
      const r = await this.deps.warehouse.query('SELECT table_schema, table_name FROM information_schema.tables');
      this.objectsCache = new Set(r.rows.map(([s, t]) => `${String(s)}.${String(t)}`));
    }
    return this.objectsCache;
  }

  /** Catalog metadata (no row data): objects per schema with kind, and column types. Not logged. */
  async catalog(): Promise<{ schema: string; name: string; kind: 'TABLE' | 'VIEW' }[]> {
    const r = await this.deps.warehouse.query(
      "SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema <> 'information_schema' ORDER BY table_schema, table_name",
    );
    return r.rows.map(([schema, name, type]) => ({ schema: String(schema), name: String(name), kind: String(type) === 'VIEW' ? 'VIEW' : 'TABLE' }));
  }

  async describe(fqn: string): Promise<{ name: string; type: string; nullable: boolean }[]> {
    if (!(await this.objects()).has(fqn)) return [];
    return this.deps.warehouse.describe(fqn);
  }

  private sources(productIds: string[]): ResultSource[] {
    return productIds.map((id) => {
      const p = this.deps.pack.products.find((x) => x.id === id);
      const live = this.state.products?.[id];
      return { productId: id, version: live?.version ?? p?.version ?? '0.0.0', certified: (live?.status ?? p?.initial_status) === 'CERTIFIED', health: productHealth(this.incidents, id) };
    });
  }

  async run(req: QueryRequest, who: Principal): Promise<GovernedResult> {
    const { pack, rubrics, warehouse } = this.deps;
    if (who.packId !== pack.manifest.id) throw new Error(`Principal belongs to pack ${who.packId}, not ${pack.manifest.id}`);
    const policies: PolicyApplication[] = [];
    let sql: string;
    let params: CellValue[] = [];
    let logicalSql: string;
    let maxRows: number;
    let maskedColumns: string[] = [];
    let rowFiltered = false;
    let productIds: string[] = [];
    let fields: OutputField[] = [];
    let ruleRefs: string[] = [];
    let purpose: string | null = null;
    const renamed: { from: string; to: string; incidentId: string; fqn: string }[] = [];

    if (req.kind === 'metric') {
      purpose = req.purpose;
      maxRows = rubrics.query.max_rows_agent;
      const compiled = compileMetricQuery(req.query, pack, {
        question: req.question,
        includeExcluded: req.includeExcluded,
        rowFilterDims: who.rowFilters.map((r) => r.dimension),
        maxRows,
      });
      productIds = compiled.productIds;
      policies.push(...checkEntitlement(pack, who, compiled.fqnsTouched, { rowLevel: false, requiredProducts: compiled.productIds }));
      for (const r of compiled.ruleRefs) policies.push({ kind: 'rule', target: compiled.view, detail: pack.rules.find((x) => x.id === r)?.text ?? r, ruleOrPolicyId: r });
      const filtered = new Map(compiled.sources.map((s) => [s.alias, rowFilterFor(pack, who, s.fqn)]));
      for (const [alias, rf] of filtered) {
        if (!rf) continue;
        rowFiltered = true;
        const fqn = compiled.sources.find((s) => s.alias === alias)?.fqn ?? alias;
        policies.push({ kind: 'row_access', target: fqn, detail: rf.detail, ruleOrPolicyId: rf.policyId });
      }
      const overlays = new Map<string, string>();
      for (const fqn of new Set(compiled.sources.map((x) => x.fqn))) {
        const o = await this.overlay(fqn);
        policies.push(...o.applied);
        for (const r of o.renamed) {
          if (new RegExp(`\\b${r.from}\\b`).test(compiled.sql)) {
            throw new IncidentBlocked(`${r.incidentId}: ${fqn}.${r.from} was renamed upstream to ${r.to}, so this metric cannot be computed until the incident is resolved.`, r.incidentId, productsForObject(pack, fqn));
          }
        }
        if (o.sql !== fqn) overlays.set(fqn, o.sql);
      }
      sql = compiled.render({
        source: (s) => {
          const rf = filtered.get(s.alias);
          const base = overlays.get(s.fqn);
          if (rf) return `(SELECT * FROM ${base ? `${base} __o` : s.fqn} WHERE ${rf.predicate}) ${s.alias}`;
          return `${base ?? s.fqn} ${s.alias}`;
        },
        project: (field, expr) => {
          const mask = field.lineage ? maskFor(pack, who, field.lineage, this.state) : null;
          if (!mask) return expr;
          maskedColumns.push(field.name);
          policies.push({ kind: 'masking', target: field.lineage ?? field.name, detail: `${mask.classes.join(', ')} masked with ${mask.macro}`, ruleOrPolicyId: mask.policyId });
          return `GOVERNANCE.${mask.macro}(${expr})`;
        },
      });
      params = compiled.params;
      logicalSql = compiled.sql;
      fields = compiled.fields;
      ruleRefs = compiled.ruleRefs;
    } else if (req.kind === 'preview') {
      purpose = 'preview';
      maxRows = Math.min(req.limit ?? rubrics.query.preview_rows, rubrics.query.preview_rows * 2);
      const fqn = req.fqn;
      if (!(await this.objects()).has(fqn)) throw new SqlRejected(`${fqn} does not exist.`, 'Pick an object from the Explorer tree.');
      productIds = productsForObject(pack, fqn);
      policies.push(...checkEntitlement(pack, who, [fqn], { rowLevel: true }));
      const o = await this.overlay(fqn);
      const cols = o.columns;
      const g = governedSource(pack, who, fqn, cols, this.state, o.sql);
      policies.push(...o.applied, ...g.applied);
      maskedColumns = g.masked;
      rowFiltered = g.rowFiltered;
      sql = `SELECT * FROM ${g.sql === fqn ? fqn : `${g.sql} AS "${fqn.split('.')[1]}"`} LIMIT ${maxRows}`;
      logicalSql = `SELECT * FROM ${fqn} LIMIT ${maxRows}`;
      fields = cols.map((c) => ({ name: c, role: 'column', label: c, lineage: `${fqn}.${c}` }));
    } else {
      purpose = req.source;
      maxRows = rubrics.query.max_rows_worksheet;
      const safety = await checkWorksheetSql(req.sql, warehouse, await this.objects());
      if (!safety.ok) throw new SqlRejected(safety.reason, safety.hint);
      const fqns = [...new Set(safety.tables.map((t) => t.fqn))];
      productIds = [...new Set(fqns.flatMap((f) => productsForObject(pack, f)))].sort();
      policies.push(...checkEntitlement(pack, who, fqns, { rowLevel: true }));
      const governed = new Map<string, string>();
      for (const fqn of fqns) {
        const o = await this.overlay(fqn);
        renamed.push(...o.renamed.map((r) => ({ ...r, fqn })));
        const g = governedSource(pack, who, fqn, o.columns, this.state, o.sql);
        governed.set(fqn, g.sql);
        policies.push(...o.applied, ...g.applied);
        maskedColumns.push(...g.masked);
        rowFiltered ||= g.rowFiltered;
      }
      const body = req.sql.trim().replace(/;\s*$/, '');
      sql = `SELECT * FROM (\n${rewriteTables(body, safety.tables, (t) => governed.get(t.fqn) ?? t.fqn)}\n) worksheet LIMIT ${maxRows + 1}`;
      logicalSql = body;
    }

    policies.push({ kind: 'limit', target: req.kind, detail: `max ${maxRows} rows, ${rubrics.query.statement_timeout_ms} ms timeout` });
    let result: Awaited<ReturnType<typeof warehouse.query>>;
    try {
      result = await warehouse.query(sql, params, { timeoutMs: rubrics.query.statement_timeout_ms, maxRows });
    } catch (e) {
      // A worksheet that names a column an open schema-drift incident renamed fails like production would.
      const r = renamed.find((x) => e instanceof Error && e.message.includes(`"${x.from}"`));
      if (r) throw new IncidentBlocked(`${r.incidentId}: ${r.fqn}.${r.from} was renamed upstream to ${r.to}.`, r.incidentId, productsForObject(pack, r.fqn));
      throw e;
    }
    if (req.kind === 'sql') fields = result.columns.map((c) => ({ name: c.name, role: 'column', label: c.name }));
    const displaySql = toDisplaySql(logicalSql, params, pack.manifest.database, policies);
    const queryLogId = await this.deps.log.write({
      personaId: who.personaId,
      kind: req.kind,
      purpose,
      sqlHash: hash(`${sql}\u0000${JSON.stringify(params)}`),
      displaySql,
      productIds,
      policies,
      rowCount: result.rowCount,
      elapsedMs: result.elapsedMs,
    });
    return {
      ...result,
      sql,
      displaySql,
      policiesApplied: policies,
      maskedColumns: [...new Set(maskedColumns)],
      rowFiltered,
      sources: this.sources(productIds),
      queryLogId,
      ruleRefs,
      fields,
    };
  }
}
