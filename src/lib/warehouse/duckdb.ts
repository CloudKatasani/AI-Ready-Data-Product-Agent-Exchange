/**
 * DuckDB adapter — the ONLY module allowed to import the DuckDB driver (invariant I02, lint-enforced).
 * Everything else reaches warehouse data through QueryService (Phase 2) or the build pipeline.
 */
import { DuckDBInstance, type DuckDBConnection, dateValue, timestampValue } from '@duckdb/node-api';
import type { AppendColumnType, CellValue, ColumnInfo, QueryOptions, QueryResult, WarehouseBuilder } from './adapter';

const SAFE_SETTINGS = ['SET enable_external_access = false', 'SET lock_configuration = true'];

function normalise(v: unknown, type: string): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
  if (v instanceof Date) {
    const iso = v.toISOString();
    return type === 'DATE' ? iso.slice(0, 10) : iso.replace('T', ' ').slice(0, 19);
  }
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  return JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? x.toString() : x));
}

class DuckDbWarehouse implements WarehouseBuilder {
  readonly dialect = 'duckdb' as const;

  constructor(
    private readonly instance: DuckDBInstance,
    private readonly conn: DuckDBConnection,
  ) {}

  async query(sql: string, params: CellValue[] = [], opts: QueryOptions = {}): Promise<QueryResult> {
    const started = performance.now();
    const timer = opts.timeoutMs ? setTimeout(() => this.conn.interrupt(), opts.timeoutMs) : undefined;
    try {
      const reader = await this.conn.runAndReadAll(sql, params);
      const types = reader.columnTypes().map(String);
      const names = reader.columnNames();
      const all = reader.getRowsJS();
      const max = opts.maxRows ?? Number.POSITIVE_INFINITY;
      const rows = all.slice(0, max).map((r) => r.map((v, i) => normalise(v, types[i] ?? '')));
      return {
        columns: names.map((name, i) => ({ name, type: types[i] ?? 'UNKNOWN' })),
        rows,
        rowCount: rows.length,
        elapsedMs: Math.round(performance.now() - started),
        truncated: all.length > rows.length,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async describe(fqn: string): Promise<ColumnInfo[]> {
    const [schema, table] = fqn.split('.');
    const r = await this.query(
      'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position',
      [schema ?? '', table ?? ''],
    );
    return r.rows.map(([name, type, nullable]) => ({ name: String(name), type: String(type), nullable: nullable === 'YES' }));
  }

  async exec(sql: string): Promise<void> {
    await this.conn.run(sql);
  }

  async append(fqn: string, types: AppendColumnType[], columns: CellValue[][], rowCount: number): Promise<void> {
    const [schema, table] = fqn.split('.');
    const appender = await this.conn.createAppender(table ?? fqn, schema ?? null);
    try {
      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < types.length; c++) {
          const v = columns[c]?.[r] ?? null;
          if (v === null) {
            appender.appendNull();
            continue;
          }
          switch (types[c]) {
            case 'VARCHAR':
              appender.appendVarchar(String(v));
              break;
            case 'INTEGER':
              appender.appendInteger(Number(v));
              break;
            case 'BIGINT':
              appender.appendBigInt(BigInt(Math.round(Number(v))));
              break;
            case 'DOUBLE':
              appender.appendDouble(Number(v));
              break;
            case 'BOOLEAN':
              appender.appendBoolean(Boolean(v));
              break;
            case 'DATE':
              appender.appendDate(dateValue(Number(v)));
              break;
            case 'TIMESTAMP':
              appender.appendTimestamp(timestampValue(BigInt(Math.round(Number(v))) * 1_000_000n));
              break;
          }
        }
        appender.endRow();
        if (r % 10_000 === 9_999) appender.flushSync();
      }
      appender.flushSync();
    } finally {
      appender.closeSync();
    }
  }

  async close(): Promise<void> {
    this.conn.closeSync();
    this.instance.closeSync();
  }
}

export interface OpenOptions {
  readOnly?: boolean;
  threads?: number;
}

/** Opens (or creates) a warehouse file with external access disabled and configuration locked. */
export async function openDuckDb(path: string, opts: OpenOptions = {}): Promise<WarehouseBuilder> {
  const instance = await DuckDBInstance.create(path, {
    access_mode: opts.readOnly ? 'READ_ONLY' : 'READ_WRITE',
    ...(opts.threads ? { threads: String(opts.threads) } : {}),
  });
  const conn = await instance.connect();
  for (const s of SAFE_SETTINGS) await conn.run(s);
  return new DuckDbWarehouse(instance, conn);
}

export interface ParquetJob {
  /** SELECT statement whose rows are exported. */
  select: string;
  /** Absolute output path. */
  file: string;
}

/**
 * Exports query results to Parquet (Snowflake deploy bundles, ADR-0025). The only connection with file
 * access: read-only on the warehouse, opened for the export and closed again; request-time connections keep
 * external access disabled. Each file is read back, and its row count returned, so the bundle is verified.
 */
export async function exportParquet(path: string, jobs: ParquetJob[]): Promise<{ file: string; rows: number }[]> {
  const instance = await DuckDBInstance.create(path, { access_mode: 'READ_ONLY' });
  const conn = await instance.connect();
  try {
    const out: { file: string; rows: number }[] = [];
    for (const j of jobs) {
      const target = j.file.replace(/'/g, "''");
      await conn.run(`COPY (${j.select}) TO '${target}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
      const r = await conn.runAndReadAll(`SELECT count(*) FROM read_parquet('${target}')`);
      out.push({ file: j.file, rows: Number(r.getRows()[0]?.[0] ?? 0) });
    }
    return out;
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
}
