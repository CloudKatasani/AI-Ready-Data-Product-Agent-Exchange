import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Pack, Scale, SourceTable } from '@/lib/packs/schema';
import type { AppendColumnType, WarehouseBuilder } from './adapter';
import { openDuckDb } from './duckdb';
import { generateBronze } from './generate';
import { createGeneratedObjects, createBuildMacros, createSemanticViews } from './generated';
import { LAYER_SCHEMAS } from './layout';

/** Bump when generator semantics change so cached warehouses rebuild. */
export const GENERATOR_VERSION = 1;

export interface BuildResult {
  packId: string;
  scale: Scale;
  path: string;
  contentHash: string;
  cached: boolean;
  elapsedMs: number;
  timings: Record<string, number>;
  checksums: Record<string, { rows: number; md5: string }>;
}

export interface BuildOptions {
  scale: Scale;
  outDir: string;
  force?: boolean;
  /** Build into this exact file (no cache, no rename) — used by determinism tests. */
  path?: string;
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = join(dir, name);
      if (name === 'golden.json') return [];
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

/** Content hash of everything that determines warehouse bytes: pack files, scale, generator version. */
export function packContentHash(pack: Pack, scale: Scale): string {
  const h = createHash('sha256');
  h.update(`v${GENERATOR_VERSION}|${scale}|`);
  for (const file of walk(pack.root)) {
    h.update(relative(pack.root, file));
    h.update(readFileSync(file));
  }
  return h.digest('hex');
}

function appendType(type: string): AppendColumnType {
  if (type.startsWith('DECIMAL')) return 'DOUBLE';
  return type as AppendColumnType;
}

async function loadBronze(w: WarehouseBuilder, pack: Pack, scale: Scale): Promise<void> {
  const tables = generateBronze(pack, scale);
  for (const t of tables) {
    const spec: SourceTable = t.spec;
    const cols = spec.columns.map((c) => `${c.name} ${c.type}`);
    await w.exec(`CREATE OR REPLACE TABLE RAW_BRONZE.${spec.name} (${cols.join(', ')}, _op VARCHAR, _loaded_at TIMESTAMP)`);
    const types: AppendColumnType[] = [...spec.columns.map((c) => appendType(c.type)), 'VARCHAR', 'TIMESTAMP'];
    await w.append(`RAW_BRONZE.${spec.name}`, types, [...t.data, t.ops, t.loadedAt], t.ops.length);
  }
}

/** Per-table row count and an order-independent content hash of every base table (10 §3 determinism check). */
export async function tableChecksums(w: WarehouseBuilder): Promise<Record<string, { rows: number; md5: string }>> {
  const tables = await w.query(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' ORDER BY table_schema, table_name",
  );
  const out: Record<string, { rows: number; md5: string }> = {};
  for (const [schema, name] of tables.rows) {
    const fqn = `${String(schema)}.${String(name)}`;
    // Sum of per-row hashes: independent of physical row order, cheap on large tables.
    const r = await w.query(`SELECT count(*), md5(CAST(coalesce(sum(hash(t)::HUGEINT), 0) AS VARCHAR)) FROM ${fqn} t`);
    const [rows, md5] = r.rows[0] ?? [0, ''];
    out[fqn] = { rows: Number(rows), md5: String(md5) };
  }
  return out;
}

async function timed(timings: Record<string, number>, key: string, fn: () => Promise<void>): Promise<void> {
  const t0 = performance.now();
  await fn();
  timings[key] = Math.round(performance.now() - t0);
}

/** Runs every Silver then Gold SQL file in path order; a failure names the file. */
async function runPackSql(w: WarehouseBuilder, pack: Pack, layer: 'silver' | 'gold'): Promise<void> {
  for (const file of pack.sql.filter((f) => f.layer === layer)) {
    try {
      await w.exec(file.sql);
    } catch (e) {
      throw new Error(`${file.path}: ${(e as Error).message}`);
    }
  }
}

/** Builds `data/warehouse/<pack>.duckdb` (04 §5): Bronze generation → Silver/Gold SQL → generated layers. */
export async function buildWarehouse(pack: Pack, opts: BuildOptions): Promise<BuildResult> {
  const started = performance.now();
  const id = pack.manifest.id;
  const contentHash = packContentHash(pack, opts.scale);
  const finalPath = opts.path ?? join(opts.outDir, `${id}.duckdb`);
  const metaPath = `${finalPath}.meta.json`;

  if (!opts.force && !opts.path && existsSync(finalPath) && existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as BuildResult;
    if (meta.contentHash === contentHash) return { ...meta, cached: true, elapsedMs: Math.round(performance.now() - started) };
  }

  mkdirSync(opts.path ? join(finalPath, '..') : opts.outDir, { recursive: true });
  const tmp = opts.path ?? `${finalPath}.building`;
  for (const p of [tmp, `${tmp}.wal`]) rmSync(p, { force: true });

  const timings: Record<string, number> = {};
  const w = await openDuckDb(tmp);
  let checksums: BuildResult['checksums'] = {};
  try {
    await timed(timings, 'schemas', async () => {
      for (const schema of Object.values(LAYER_SCHEMAS)) await w.exec(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
      await createBuildMacros(w, pack);
    });
    await timed(timings, 'bronze', () => loadBronze(w, pack, opts.scale));
    await timed(timings, 'silver', () => runPackSql(w, pack, 'silver'));
    await timed(timings, 'gold', () => runPackSql(w, pack, 'gold'));
    await timed(timings, 'semantic', () => createSemanticViews(w, pack));
    await timed(timings, 'generated', () => createGeneratedObjects(w, pack));
    await timed(timings, 'checksums', async () => {
      checksums = await tableChecksums(w);
    });
    await w.exec('CHECKPOINT');
  } finally {
    await w.close();
  }

  const result: BuildResult = {
    packId: id,
    scale: opts.scale,
    path: finalPath,
    contentHash,
    cached: false,
    elapsedMs: Math.round(performance.now() - started),
    timings,
    checksums,
  };
  if (!opts.path) {
    rmSync(finalPath, { force: true });
    rmSync(`${finalPath}.wal`, { force: true });
    renameSync(tmp, finalPath);
    writeFileSync(metaPath, JSON.stringify(result, null, 2));
  }
  return result;
}

/** Opens a built warehouse read-only (validator, previews before QueryService exists). */
export async function openWarehouseReadOnly(path: string): Promise<WarehouseBuilder> {
  return openDuckDb(path, { readOnly: true });
}
