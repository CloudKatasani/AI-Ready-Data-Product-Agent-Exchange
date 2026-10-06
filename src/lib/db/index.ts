import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getEnv } from '@/lib/config/env';
import { PROFILE_COOKIE, verifyValue } from '@/lib/utils/signed';

/**
 * App-state database (Prisma), one database per Demo Profile (ADR-0024).
 *
 * - The **control DB** (`DATABASE_URL`) holds the Demo Profiles and the demo state used when no profile is
 *   active.
 * - Each profile has its own SQLite file, a copy of the control DB taken when the profile is saved. It is
 *   chosen per call from the signed profile cookie, or from an explicit `withProfileDb()` scope (scripts,
 *   tests, presenter actions).
 *
 * Two presenters on one server therefore never see each other's gates, grants, incidents or answers.
 * Engines keep calling `db()` unchanged.
 */

const g = globalThis as unknown as { keystoneClients?: Map<string, PrismaClient>; keystoneProfileScope?: AsyncLocalStorage<string | null> };
const clients = (g.keystoneClients ??= new Map());
const scope = (g.keystoneProfileScope ??= new AsyncLocalStorage<string | null>());

/**
 * SQLite `file:` URLs are relative to prisma/schema.prisma (Prisma's convention); make them absolute. SQLite
 * gets one pooled connection unless the URL says otherwise: writes serialise anyway, and snapshot reset
 * (ATTACH, PRAGMA foreign_keys) needs every statement on the same connection (ADR-0021).
 */
export function resolveDatabaseUrl(url: string, cwd = process.cwd()): string {
  if (!url.startsWith('file:')) return url;
  const [path = '', query = ''] = url.slice('file:'.length).split('?');
  const abs = isAbsolute(path) ? path : resolve(cwd, 'prisma', path);
  const params = new URLSearchParams(query);
  if (!params.has('connection_limit')) params.set('connection_limit', '1');
  return `file:${abs}?${params.toString()}`;
}

const controlUrl = () => resolveDatabaseUrl(getEnv().DATABASE_URL);
/** Absolute path of the control DB file, or null when it is not SQLite (per-profile DBs are SQLite only). */
function controlFile(): string | null {
  const url = controlUrl();
  return url.startsWith('file:') ? (url.slice('file:'.length).split('?')[0] ?? null) : null;
}

const PROFILE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** `<control db dir>/<control db name>-profiles/<profileId>.db`, next to the control DB (same volume). */
export function profileDbPath(profileId: string): string | null {
  const file = controlFile();
  if (!file || !PROFILE_ID.test(profileId)) return null;
  return join(dirname(file), `${basename(file, '.db')}-profiles`, `${profileId}.db`);
}

function clientFor(url: string): PrismaClient {
  let c = clients.get(url);
  if (!c) {
    c = new PrismaClient({ datasourceUrl: url });
    clients.set(url, c);
  }
  return c;
}

/** The control DB client: Demo Profiles, and the default demo state. */
export function controlDb(): PrismaClient {
  return clientFor(controlUrl());
}

/** Client for one profile's DB (it must exist; see `createProfileDb`). */
export function profileDb(profileId: string): PrismaClient | null {
  const path = profileDbPath(profileId);
  return path && existsSync(path) ? clientFor(resolveDatabaseUrl(`file:${path}`)) : null;
}

/** Runs `fn` with `db()` routed to the given profile's DB (or the control DB for null). */
export function withProfileDb<T>(profileId: string | null, fn: () => T): T {
  return scope.run(profileId, fn);
}

/**
 * The profile whose DB this call should use: explicit scope first, then the request's signed cookie.
 * `scoped` is read when a call is *created* (a deferred call may be awaited after its scope has exited).
 */
async function activeProfileId(scoped: string | null | undefined = scope.getStore()): Promise<string | null> {
  if (scoped !== undefined) return scoped;
  try {
    const { cookies } = await import('next/headers');
    return verifyValue((await cookies()).get(PROFILE_COOKIE)?.value, getEnv().SESSION_SECRET);
  } catch {
    return null; // outside a request (scripts, tests, seed)
  }
}

async function activeClient(scoped: string | null | undefined = scope.getStore()): Promise<PrismaClient> {
  const id = await activeProfileId(scoped);
  return (id && profileDb(id)) || controlDb();
}

/** A deferred client call: runs on the active DB when awaited, or inside an array `$transaction`. */
class Deferred implements PromiseLike<unknown> {
  private readonly scoped = scope.getStore();
  private result: Promise<unknown> | undefined;
  constructor(
    private readonly model: string | null,
    private readonly method: string,
    private readonly args: unknown[],
  ) {}
  materialize(c: PrismaClient): unknown {
    const target = (this.model ? (c as unknown as Record<string, Record<string, unknown>>)[this.model] : c) as Record<string, (...a: unknown[]) => unknown>;
    const fn = target[this.method];
    if (typeof fn !== 'function') throw new TypeError(`Unknown Prisma method ${this.model ?? ''}.${this.method}`);
    return fn.apply(target, this.args);
  }
  /** Runs once, however many times it is awaited (like a Prisma promise). */
  run(): Promise<unknown> {
    this.result ??= activeClient(this.scoped).then((c) => this.materialize(c));
    return this.result;
  }
  then<A = unknown, B = never>(onfulfilled?: ((v: unknown) => A | PromiseLike<A>) | null, onrejected?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
  catch<B = never>(onrejected?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<unknown> {
    return this.run().catch(onrejected);
  }
  finally(onfinally?: (() => void) | null): Promise<unknown> {
    return this.run().finally(onfinally);
  }
}

const RAW = new Set(['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);

let router: PrismaClient | undefined;

/**
 * App-state database. Every call is routed to the active profile's DB (or the control DB) when it runs,
 * so a module-level `db()` reference stays correct across requests.
 */
export function db(): PrismaClient {
  router ??= new Proxy(controlDb(), {
    get(control, prop: string | symbol) {
      if (typeof prop !== 'string') return Reflect.get(control, prop);
      if (prop === '$transaction') {
        return async (arg: unknown, opts?: unknown) => {
          const c = await activeClient();
          const tx = c.$transaction.bind(c) as (a: unknown, o?: unknown) => Promise<unknown>;
          return Array.isArray(arg) ? tx(arg.map((op) => (op instanceof Deferred ? op.materialize(c) : op)), opts) : tx(arg, opts);
        };
      }
      if (RAW.has(prop)) return (...args: unknown[]) => new Deferred(null, prop, args);
      if (prop === '$disconnect') return disconnectAll;
      const value: unknown = Reflect.get(control, prop);
      if (value && typeof value === 'object' && 'findMany' in value) {
        return new Proxy(value, { get: (_m, method: string | symbol) => (typeof method === 'string' ? (...args: unknown[]) => new Deferred(prop, method, args) : undefined) });
      }
      return value;
    },
  });
  return router;
}

export async function disconnectAll(): Promise<void> {
  const all = [...clients.values()];
  clients.clear();
  router = undefined;
  await Promise.all(all.map((c) => c.$disconnect()));
}

/**
 * Creates (or replaces) a profile's DB as a consistent copy of the control DB (`VACUUM INTO`).
 * Returns false when per-profile DBs are unavailable (non-SQLite control DB).
 */
export async function createProfileDb(profileId: string): Promise<boolean> {
  const path = profileDbPath(profileId);
  if (!path) return false;
  await dropProfileDb(profileId);
  mkdirSync(dirname(path), { recursive: true });
  await controlDb().$executeRawUnsafe(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  return true;
}

/** True when the profile DB exists and has every migration the control DB has (else it must be recreated). */
export async function profileDbCurrent(profileId: string): Promise<boolean> {
  const p = profileDb(profileId);
  if (!p) return false;
  const latest = async (c: PrismaClient) => (await c.$queryRawUnsafe<{ n: string | null }[]>('SELECT MAX(migration_name) AS n FROM _prisma_migrations'))[0]?.n ?? null;
  try {
    return (await latest(p)) === (await latest(controlDb()));
  } catch {
    return false;
  }
}

/** Closes and deletes a profile's DB (profiles are archived, never hard-deleted; their DB file goes). */
export async function dropProfileDb(profileId: string): Promise<void> {
  const path = profileDbPath(profileId);
  if (!path) return;
  const url = resolveDatabaseUrl(`file:${path}`);
  const c = clients.get(url);
  if (c) {
    clients.delete(url);
    await c.$disconnect();
  }
  for (const f of [path, `${path}-journal`, `${path}-wal`, `${path}-shm`]) rmSync(f, { force: true });
}
