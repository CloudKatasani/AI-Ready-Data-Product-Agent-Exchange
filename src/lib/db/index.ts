import { isAbsolute, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getEnv } from '@/lib/config/env';

const globalForPrisma = globalThis as unknown as { keystonePrisma?: PrismaClient };

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

/** App-state database (Prisma). One client per process; reused across dev hot reloads. */
export function db(): PrismaClient {
  globalForPrisma.keystonePrisma ??= new PrismaClient({ datasourceUrl: resolveDatabaseUrl(getEnv().DATABASE_URL) });
  return globalForPrisma.keystonePrisma;
}
