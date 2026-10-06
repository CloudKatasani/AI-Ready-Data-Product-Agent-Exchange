import type { Pack, Scale, SourceTable } from '@/lib/packs/schema';
import { clockFor } from '../clock';
import { applyCdcNoise, applyPlants } from './noise';
import { generateBase } from './table';
import type { GeneratedTable } from './types';

export type { Cell, GeneratedTable } from './types';
export { compileFormula, formulaColumns } from '@/lib/packs/formula';

/** Orders tables so every `fk` parent is generated before its children. */
export function topoOrder(tables: SourceTable[]): SourceTable[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const done = new Set<string>();
  const visiting = new Set<string>();
  const out: SourceTable[] = [];
  const visit = (t: SourceTable) => {
    if (done.has(t.name)) return;
    if (visiting.has(t.name)) throw new Error(`fk cycle through ${t.name}`);
    visiting.add(t.name);
    for (const c of t.columns) {
      if ('fk' in c.gen && c.gen.fk.table !== t.name) {
        const parent = byName.get(c.gen.fk.table);
        if (!parent) throw new Error(`${t.name}.${c.name}: unknown fk table ${c.gen.fk.table}`);
        visit(parent);
      }
    }
    visiting.delete(t.name);
    done.add(t.name);
    out.push(t);
  };
  [...tables].sort((a, b) => a.name.localeCompare(b.name)).forEach(visit);
  return out;
}

/** Generates every Bronze table of a pack: base rows → plants → CDC noise. Pure and deterministic. */
export function generateBronze(pack: Pack, scale: Scale): GeneratedTable[] {
  const clock = clockFor(pack.manifest.asOf);
  const ctx = { seed: pack.manifest.seed, scale, clock, tables: new Map<string, GeneratedTable>() };
  const out: GeneratedTable[] = [];
  for (const spec of topoOrder(pack.sources)) {
    const t = generateBase(spec, ctx);
    applyPlants(t, ctx.seed);
    ctx.tables.set(spec.name, t);
    out.push(t);
  }
  // Noise last so children reference clean parent keys.
  for (const t of out) applyCdcNoise(t, ctx.seed, clock);
  return out;
}
