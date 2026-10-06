import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Points this test file's worker at a private copy of the seeded test DB (and a private snapshot dir), for
 * tests that restore snapshots — a reset rewrites every table and must not race other files' tests. The
 * copy is a consistent `VACUUM INTO` snapshot even while other files write. Await before anything touches
 * `db()` or `getEnv()`.
 */
export async function isolateDb(name: string): Promise<{ dbFile: string; snapshotDir: string }> {
  const dataDir = join(process.cwd(), 'data');
  const dbFile = join(dataDir, `test-${name}.db`);
  rmSync(dbFile, { force: true });
  const source = new PrismaClient({ datasourceUrl: `file:${join(dataDir, 'test-app.db')}` });
  try {
    await source.$executeRawUnsafe(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
  } finally {
    await source.$disconnect();
  }
  const snapshotDir = join(dataDir, `test-snapshots-${name}`);
  rmSync(snapshotDir, { recursive: true, force: true });
  mkdirSync(snapshotDir, { recursive: true });
  process.env.DATABASE_URL = `file:../data/test-${name}.db`;
  process.env.KEYSTONE_SNAPSHOT_DIR = snapshotDir;
  return { dbFile, snapshotDir };
}
