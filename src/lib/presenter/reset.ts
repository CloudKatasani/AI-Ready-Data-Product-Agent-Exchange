/**
 * Demo reset (invariant I09, ADR-0007): snapshots of the app DB taken with `VACUUM INTO` and restored in
 * place — every table except Demo Profiles and migrations is replaced from the snapshot inside one
 * transaction — so a reset is a copy, not a re-seed, and the profile and its branding survive it. The
 * warehouse is read-only at runtime (incidents and knockout are query-time overlays), so it needs no
 * restore. SQLite only in v1; Postgres falls back to re-seeding (ADR-0021).
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db';

const KEEP = ['_prisma_migrations', 'DemoProfile'];
const KEY = /^[A-Za-z0-9_-]{1,120}$/;

export class ResetError extends Error {}

export function snapshotDir(): string {
  return process.env.KEYSTONE_SNAPSHOT_DIR ?? join(process.cwd(), 'data', 'snapshots');
}

export function snapshotPath(key: string): string {
  if (!KEY.test(key)) throw new ResetError(`Invalid snapshot key: ${key}`);
  return join(snapshotDir(), `${key}.db`);
}

export const hasSnapshot = (key: string) => existsSync(snapshotPath(key));

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

function assertSqlite() {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.DATABASE_PROVIDER === 'postgresql' || url.startsWith('postgres')) throw new ResetError('Snapshot reset is available for the SQLite app DB only.');
}

/** Writes (or replaces) the snapshot `key` from the current app DB. */
export async function takeSnapshot(key: string): Promise<{ ms: number }> {
  assertSqlite();
  const started = performance.now();
  const file = snapshotPath(key);
  mkdirSync(snapshotDir(), { recursive: true });
  rmSync(file, { force: true });
  await db().$executeRawUnsafe(`VACUUM INTO ${sqlString(file)}`);
  return { ms: Math.round(performance.now() - started) };
}

/** Replaces every restorable table from snapshot `key`. Foreign keys are off for the copy (same connection). */
export async function restoreSnapshot(key: string): Promise<{ ms: number; tables: number }> {
  assertSqlite();
  const file = snapshotPath(key);
  if (!existsSync(file)) throw new ResetError(`No snapshot ${key}`);
  const started = performance.now();
  const prisma = db();
  let tables = 0;
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.$executeRawUnsafe(`ATTACH DATABASE ${sqlString(file)} AS snap`);
  try {
    await prisma.$transaction(async (tx) => {
      const names = (await tx.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM snap.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name).filter((n) => !KEEP.includes(n));
      for (const t of names) {
        const ident = `"${t.replace(/"/g, '""')}"`;
        await tx.$executeRawUnsafe(`DELETE FROM main.${ident}`);
        await tx.$executeRawUnsafe(`INSERT INTO main.${ident} SELECT * FROM snap.${ident}`);
      }
      tables = names.length;
    });
  } finally {
    await prisma.$executeRawUnsafe('DETACH DATABASE snap');
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }
  return { ms: Math.round(performance.now() - started), tables };
}

export function deleteSnapshot(key: string): void {
  rmSync(snapshotPath(key), { force: true });
}

/** Removes every snapshot whose key starts with `prefix` (a profile's story checkpoints). */
export function deleteSnapshots(prefix: string): number {
  if (!KEY.test(prefix) || !existsSync(snapshotDir())) return 0;
  const files = readdirSync(snapshotDir()).filter((f) => f.startsWith(prefix) && f.endsWith('.db'));
  for (const f of files) rmSync(join(snapshotDir(), f), { force: true });
  return files.length;
}

/** Checkpoint key for a story step of a profile. */
export const checkpointKey = (profileId: string, storyId: string, stepId: string) => `${profileId}__${storyId}-${stepId}`;

/**
 * Reset (AC1.4): restore the profile's starting snapshot and drop its checkpoints (they are re-taken the
 * first time each checkpoint step is reached after a reset).
 */
export async function resetDemo(profileId: string): Promise<{ ms: number; tables: number }> {
  const r = await restoreSnapshot(profileId);
  deleteSnapshots(`${profileId}__`);
  return r;
}

/** Go to a checkpoint step: restore its snapshot if it exists, else take it now. */
export async function checkpoint(profileId: string, storyId: string, stepId: string): Promise<'restored' | 'taken'> {
  const key = checkpointKey(profileId, storyId, stepId);
  if (hasSnapshot(key)) {
    await restoreSnapshot(key);
    return 'restored';
  }
  await takeSnapshot(key);
  return 'taken';
}

/** Snapshot files on disk (Admin → snapshot management). */
export function listSnapshots(): { key: string; bytes: number; at: string }[] {
  if (!existsSync(snapshotDir())) return [];
  return readdirSync(snapshotDir())
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const st = statSync(join(snapshotDir(), f));
      return { key: f.slice(0, -3), bytes: st.size, at: st.mtime.toISOString() };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
