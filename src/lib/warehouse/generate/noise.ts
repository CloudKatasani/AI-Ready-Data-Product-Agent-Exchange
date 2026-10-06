import type { Plant, SourceColumn } from '@/lib/packs/schema';
import { type Clock, isoToEpochDay } from '../clock';
import { hashSeed, Rng } from '../rng';
import type { Cell, GeneratedTable } from './types';

/** Applies planted patterns (deterministic) to base rows — the patterns golden questions are meant to find. */
export function applyPlants(t: GeneratedTable, seed: number): void {
  const colIndex = new Map(t.spec.columns.map((c, i) => [c.name, i]));
  const col = (name: string): Cell[] => {
    const i = colIndex.get(name);
    if (i === undefined) throw new Error(`${t.spec.name}: plant references unknown column "${name}"`);
    return t.data[i] as Cell[];
  };
  for (const plant of t.spec.plant) applyPlant(t, plant, seed, col);
}

function matches(v: Cell, cond: unknown): boolean {
  if (cond && typeof cond === 'object' && 'in' in cond) return (cond as { in: unknown[] }).in.includes(v as never);
  return v === cond;
}

function applyPlant(t: GeneratedTable, plant: Plant, seed: number, col: (name: string) => Cell[]): void {
  const rng = new Rng(hashSeed(seed, t.spec.name, plant.id));
  const where = Object.entries(plant.where).map(([name, cond]) => ({ values: col(name), cond }));
  const window = plant.window
    ? { values: col(plant.window.column), type: t.spec.columns.find((c) => c.name === plant.window?.column)?.type, from: isoToEpochDay(plant.window.from), to: isoToEpochDay(plant.window.to) }
    : null;
  const adjust = Object.entries(plant.adjust).map(([name, a]) => ({ values: col(name), spec: t.spec.columns.find((c) => c.name === name) as SourceColumn, a }));
  for (let i = 0; i < t.baseRows; i++) {
    if (!where.every((w) => matches(w.values[i] ?? null, w.cond))) continue;
    if (window) {
      const v = window.values[i];
      if (typeof v !== 'number') continue;
      const day = window.type === 'TIMESTAMP' ? Math.floor(v / 86_400) : v;
      if (day < window.from || day > window.to) continue;
    }
    for (const { values, spec, a } of adjust) {
      if (a.pct !== undefined && !rng.chance(a.pct / 100)) continue;
      const cur = values[i] ?? null;
      let next: Cell = cur;
      if (a.set !== undefined) next = a.set;
      if (typeof next === 'number' && a.multiply !== undefined) next = next * a.multiply;
      if (typeof next === 'number' && a.add !== undefined) next = next + a.add;
      if (typeof next === 'number') next = spec.type === 'INTEGER' || spec.type === 'BIGINT' ? Math.round(next) : Math.round(next * 100) / 100;
      values[i] = next;
    }
  }
}

/** Generator kinds whose string output is realistic dirty-data territory (case, padding). */
function dirtyEligible(c: SourceColumn): boolean {
  if (c.dirty !== undefined) return c.dirty;
  if (c.type !== 'VARCHAR') return false;
  return 'choice' in c.gen || 'person' in c.gen || 'address' in c.gen || 'company' in c.gen || 'template' in c.gen;
}

function dirty(rng: Rng, s: string): string {
  const style = rng.int(0, 2);
  const cased = style === 0 ? s.toUpperCase() : style === 1 ? s.toLowerCase() : `${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  return rng.chance(0.5) ? `${cased}${' '.repeat(rng.int(1, 3))}` : ` ${cased}`;
}

/**
 * Computes `_loaded_at` and appends Bronze-only CDC artefacts (04 §5): dirty strings, late arrivals,
 * duplicate `U` rows and `D` tombstones. Silver SQL must clean all of these.
 */
export function applyCdcNoise(t: GeneratedTable, seed: number, clock: Clock): void {
  const rng = new Rng(hashSeed(seed, t.spec.name, '_cdc'));
  const noise = t.spec.cdc_noise;
  const n = t.baseRows;
  const fromIdx = t.spec.loaded_at_from ? t.spec.columns.findIndex((c) => c.name === t.spec.loaded_at_from) : -1;
  const fromType = fromIdx >= 0 ? t.spec.columns[fromIdx]?.type : undefined;

  for (let i = 0; i < n; i++) {
    const v = fromIdx >= 0 ? t.data[fromIdx]?.[i] : null;
    let at: number;
    if (typeof v === 'number') at = (fromType === 'DATE' ? v * 86_400 + 6 * 3600 : v) + rng.int(5, 90) * 60;
    else at = clock.asOfEndSec - rng.int(0, 30 * 86_400);
    if (rng.chance(noise.late_arrivals_pct / 100)) at += rng.int(1, 7) * 86_400;
    t.loadedAt[i] = Math.min(at, clock.asOfEndSec);
  }

  t.spec.columns.forEach((c, ci) => {
    if (!dirtyEligible(c) || noise.dirty_strings_pct === 0) return;
    const values = t.data[ci] as Cell[];
    const p = noise.dirty_strings_pct / 100;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (typeof v === 'string' && rng.chance(p)) values[i] = dirty(rng, v);
    }
  });

  const appendCopy = (i: number, op: 'U' | 'D', lagSec: number) => {
    t.data.forEach((values) => values.push(values[i] ?? null));
    t.ops.push(op);
    t.loadedAt.push(Math.min((t.loadedAt[i] ?? clock.asOfEndSec) + lagSec, clock.asOfEndSec));
  };
  for (let i = 0; i < n; i++) {
    if (rng.chance(noise.duplicate_updates_pct / 100)) appendCopy(i, 'U', rng.int(1, 48) * 3600);
    if (rng.chance(noise.deletes_pct / 100)) appendCopy(i, 'D', rng.int(1, 72) * 3600);
  }
}
