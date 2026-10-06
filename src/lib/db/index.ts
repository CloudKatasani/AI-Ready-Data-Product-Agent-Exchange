import { isAbsolute, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getEnv } from '@/lib/config/env';

const globalForPrisma = globalThis as unknown as { keystonePrisma?: PrismaClient };

/** SQLite `file:` URLs are relative to prisma/schema.prisma (Prisma's convention); make them absolute. */
export function resolveDatabaseUrl(url: string, cwd = process.cwd()): string {
  if (!url.startsWith('file:')) return url;
  const path = url.slice('file:'.length);
  return isAbsolute(path) ? url : `file:${resolve(cwd, 'prisma', path)}`;
}

/** App-state database (Prisma). One client per process; reused across dev hot reloads. */
export function db(): PrismaClient {
  globalForPrisma.keystonePrisma ??= new PrismaClient({ datasourceUrl: resolveDatabaseUrl(getEnv().DATABASE_URL) });
  return globalForPrisma.keystonePrisma;
}
