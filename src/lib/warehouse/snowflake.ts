/**
 * Snowflake adapter (12-deployment §6, ADR-0025): the `WarehouseAdapter` interface over the Snowflake SQL API
 * v2 with key-pair (JWT) auth. Uses only node:crypto and fetch (no driver dependency).
 *
 * Results are normalised to the DuckDB adapter's conventions, so every engine sees the same values:
 * - integers are numbers (or strings beyond 2^53);
 * - decimals and floats are numbers;
 * - DATE is "YYYY-MM-DD", TIMESTAMP is "YYYY-MM-DD HH:MM:SS";
 * - booleans are booleans.
 *
 * Only QueryService reaches it, via `warehouseFor()` (invariant I02 holds: no DuckDB import here).
 */
import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { SnowflakeConfig } from '@/lib/config/env';
import { wallClockMs } from '@/lib/config/wall-clock';
import type { CellValue, ColumnInfo, QueryOptions, QueryResult, WarehouseAdapter } from './adapter';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface SnowflakeOptions {
  /** Snowflake database the pack lives in (pack.manifest.database). */
  database: string;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: FetchLike;
  /** Injected in tests; defaults to reading `config.privateKeyPath`. */
  privateKeyPem?: string;
  /** Poll interval for asynchronous statements (ms). */
  pollMs?: number;
  /** Clock for JWT lifetimes (auth only); defaults to the wall clock. */
  nowMs?: () => number;
}

export class SnowflakeError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly sqlState?: string,
  ) {
    super(message);
    this.name = 'SnowflakeError';
  }
}

interface RowType {
  name: string;
  type: string;
  scale?: number | null;
  nullable?: boolean;
}

interface StatementResponse {
  code?: string;
  message?: string;
  sqlState?: string;
  statementHandle?: string;
  statementStatusUrl?: string;
  resultSetMetaData?: { numRows?: number; rowType?: RowType[]; partitionInfo?: { rowCount: number }[] };
  data?: (string | null)[][];
}

const JWT_LIFETIME_S = 59 * 60;
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/**
 * Account identifier as Snowflake expects it in JWT claims: upper case, and only the part before the first
 * dot ("xy12345.us-east-2.aws" → "XY12345", "myorg-acct.privatelink" → "MYORG-ACCT").
 */
export function jwtAccount(account: string): string {
  return (account.split('.')[0] ?? account).toUpperCase();
}

/** `SHA256:<base64>` fingerprint of the public key (what Snowflake stores as RSA_PUBLIC_KEY_FP). */
export function publicKeyFingerprint(key: KeyObject): string {
  const der = createPublicKey(key).export({ type: 'spki', format: 'der' });
  return `SHA256:${createHash('sha256').update(der).digest('base64')}`;
}

/** Key-pair JWT (RS256) for the SQL API. */
export function keyPairJwt(cfg: Pick<SnowflakeConfig, 'account' | 'user'>, key: KeyObject, nowS: number): string {
  const qualified = `${jwtAccount(cfg.account)}.${cfg.user.toUpperCase()}`;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: `${qualified}.${publicKeyFingerprint(key)}`, sub: qualified, iat: nowS, exp: nowS + JWT_LIFETIME_S }));
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${b64url(signature)}`;
}

/** SQL API binding for one positional `?` parameter. */
export function binding(v: CellValue): { type: string; value: string | null } {
  if (v === null) return { type: 'TEXT', value: null };
  if (typeof v === 'boolean') return { type: 'BOOLEAN', value: String(v) };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'FIXED', value: String(v) } : { type: 'REAL', value: String(v) };
  return { type: 'TEXT', value: v };
}

const DAY_MS = 86_400_000;

/** Snowflake SQL API cell (always text) → the DuckDB adapter's value conventions. */
export function convertCell(raw: string | null, t: RowType): CellValue {
  if (raw === null) return null;
  const type = t.type.toLowerCase();
  if (type === 'fixed') {
    const n = Number(raw);
    return (t.scale ?? 0) === 0 && !Number.isSafeInteger(n) ? raw : n;
  }
  if (type === 'real') return Number(raw);
  if (type === 'boolean') return raw === 'true' || raw === '1';
  if (type === 'date') return new Date(Number(raw) * DAY_MS).toISOString().slice(0, 10);
  if (type.startsWith('timestamp')) {
    // "seconds.fraction" (+ " offset-minutes" for TIMESTAMP_TZ): UTC wall time, second precision.
    const secs = Math.floor(Number(raw.split(' ')[0]));
    return new Date(secs * 1000).toISOString().replace('T', ' ').slice(0, 19);
  }
  return raw;
}

/** Column type names in the DuckDB adapter's vocabulary (callers format by type). */
export function columnType(t: RowType): string {
  const type = t.type.toLowerCase();
  if (type === 'fixed') return (t.scale ?? 0) === 0 ? 'BIGINT' : 'DECIMAL';
  if (type === 'real') return 'DOUBLE';
  if (type === 'text') return 'VARCHAR';
  if (type.startsWith('timestamp')) return 'TIMESTAMP';
  return type.toUpperCase();
}

/**
 * Snowflake upper-cases unquoted identifiers; DuckDB (and every pack) uses lower-case column names. Names
 * that come back entirely upper-case are reported in lower case so results and column lists line up.
 */
export function localName(name: string): string {
  return name === name.toUpperCase() ? name.toLowerCase() : name;
}

export class SnowflakeAdapter implements WarehouseAdapter {
  readonly dialect = 'snowflake' as const;
  private readonly key: KeyObject;
  private readonly fetchFn: FetchLike;
  private readonly base: string;
  private readonly now: () => number;
  private token: { jwt: string; expS: number } | null = null;

  constructor(
    private readonly cfg: SnowflakeConfig,
    private readonly opts: SnowflakeOptions,
  ) {
    this.key = createPrivateKey(opts.privateKeyPem ?? readFileSync(cfg.privateKeyPath, 'utf8'));
    this.fetchFn = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.base = `https://${cfg.host ?? `${cfg.account.toLowerCase()}.snowflakecomputing.com`}/api/v2/statements`;
    this.now = opts.nowMs ?? wallClockMs;
  }

  private headers(): Record<string, string> {
    const nowS = Math.floor(this.now() / 1000);
    if (!this.token || this.token.expS - 60 <= nowS) this.token = { jwt: keyPairJwt(this.cfg, this.key, nowS), expS: nowS + JWT_LIFETIME_S };
    return {
      Authorization: `Bearer ${this.token.jwt}`,
      'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'keystone-demo/1.0',
    };
  }

  private async call(url: string, method: 'GET' | 'POST', body: unknown, signal?: AbortSignal): Promise<StatementResponse> {
    const res = await this.fetchFn(url, { method, headers: this.headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}) });
    const json = (await res.json()) as StatementResponse;
    if (res.status === 200 || res.status === 202) return { ...json, code: res.status === 202 ? 'ASYNC' : json.code };
    throw new SnowflakeError(json.message ?? `Snowflake SQL API returned ${res.status}`, json.code, json.sqlState);
  }

  /** Runs one statement; waits for asynchronous execution; reads further result partitions up to `maxRows`. */
  async query(sql: string, params: CellValue[] = [], opts: QueryOptions = {}): Promise<QueryResult> {
    const started = performance.now();
    const signal = opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs + 5_000) : undefined;
    const body = {
      statement: sql,
      ...(opts.timeoutMs ? { timeout: Math.ceil(opts.timeoutMs / 1000) } : {}),
      database: this.opts.database,
      // Deployed tables use unquoted (upper-case) names; the governed path quotes lower-case identifiers.
      parameters: { QUOTED_IDENTIFIERS_IGNORE_CASE: 'TRUE' },
      ...(this.cfg.warehouse ? { warehouse: this.cfg.warehouse } : {}),
      ...(this.cfg.role ? { role: this.cfg.role } : {}),
      ...(params.length ? { bindings: Object.fromEntries(params.map((p, i) => [String(i + 1), binding(p)])) } : {}),
    };
    let r = await this.call(this.base, 'POST', body, signal);
    while (r.code === 'ASYNC' && r.statementHandle) {
      await new Promise((ok) => setTimeout(ok, this.opts.pollMs ?? 250));
      r = await this.call(`${this.base}/${r.statementHandle}`, 'GET', undefined, signal);
    }
    const rowType = r.resultSetMetaData?.rowType ?? [];
    const total = r.resultSetMetaData?.numRows ?? r.data?.length ?? 0;
    const limit = opts.maxRows ?? Number.POSITIVE_INFINITY;
    const raw: (string | null)[][] = [...(r.data ?? [])];
    const partitions = r.resultSetMetaData?.partitionInfo?.length ?? 1;
    for (let p = 1; p < partitions && raw.length < limit && r.statementHandle; p++) {
      const part = await this.call(`${this.base}/${r.statementHandle}?partition=${p}`, 'GET', undefined, signal);
      raw.push(...(part.data ?? []));
    }
    const rows = raw.slice(0, limit).map((row) => row.map((cell, i) => convertCell(cell, rowType[i] ?? { name: '', type: 'text' })));
    return {
      columns: rowType.map((t) => ({ name: localName(t.name), type: columnType(t) })),
      rows,
      rowCount: rows.length,
      elapsedMs: Math.round(performance.now() - started),
      truncated: total > rows.length,
    };
  }

  /** Columns of `SCHEMA.OBJECT` in the pack database (DESCRIBE TABLE works for views too). */
  async describe(fqn: string): Promise<ColumnInfo[]> {
    if (!/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(fqn)) throw new SnowflakeError(`Invalid object name: ${fqn}`);
    const r = await this.query(`DESCRIBE TABLE ${this.opts.database}.${fqn}`);
    const col = (n: string) => r.columns.findIndex((c) => c.name.toLowerCase() === n);
    const [name, type, nul] = [col('name'), col('type'), col('null?')];
    return r.rows.map((row) => ({ name: localName(String(row[name] ?? '')), type: String(row[type] ?? ''), nullable: String(row[nul] ?? 'Y') === 'Y' }));
  }

  /** Stateless HTTP: nothing to close. */
  async close(): Promise<void> {}
}
