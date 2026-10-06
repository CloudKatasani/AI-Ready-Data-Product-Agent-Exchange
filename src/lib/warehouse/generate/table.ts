import type { GenSpec, Scale, SourceColumn, SourceTable } from '@/lib/packs/schema';
import { type Clock, dayParts, epochDayToIso, epochSecondsToIso, resolveDay } from '../clock';
import { cumulativeOf, hashSeed, Rng } from '../rng';
import { compileFormula } from '@/lib/packs/formula';
import { COMPANY_STEMS, COMPANY_SUFFIXES, FIRST_NAMES, LAST_NAMES, STREETS } from './names';
import type { Cell, GeneratedTable } from './types';

export interface GenContext {
  seed: number;
  scale: Scale;
  clock: Clock;
  /** Already generated tables, by name (parents of `fk`). */
  tables: Map<string, GeneratedTable>;
}

const isInt = (type: string) => type === 'INTEGER' || type === 'BIGINT';
const isTemporal = (type: string) => type === 'DATE' || type === 'TIMESTAMP';

function finishNumber(v: number, col: SourceColumn, clamp: { min?: number; max?: number; decimals?: number }): number {
  let x = v;
  if (clamp.min !== undefined) x = Math.max(clamp.min, x);
  if (clamp.max !== undefined) x = Math.min(clamp.max, x);
  if (isInt(col.type)) return Math.round(x);
  const d = clamp.decimals ?? 2;
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

function dayTable(from: number, to: number, seasonality?: { month?: number[]; weekday?: number[] }): { days: Int32Array; cumulative: Float64Array } {
  const n = Math.max(1, to - from + 1);
  const days = new Int32Array(n);
  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    const day = from + i;
    days[i] = day;
    const { month, weekday } = dayParts(day);
    weights.push((seasonality?.month?.[month] ?? 1) * (seasonality?.weekday?.[weekday] ?? 1));
  }
  return { days, cumulative: cumulativeOf(weights) };
}

function zipfCumulative(n: number, s: number): Float64Array {
  const w: number[] = [];
  for (let i = 1; i <= n; i++) w.push(1 / i ** s);
  return cumulativeOf(w);
}

function formatCell(v: Cell, type: string): string {
  if (v === null) return '';
  if (type === 'DATE' && typeof v === 'number') return epochDayToIso(v);
  if (type === 'TIMESTAMP' && typeof v === 'number') return epochSecondsToIso(v);
  return String(v);
}

/** Generates one column of base values. `cols` holds the earlier columns of this table. */
function generateColumn(
  table: SourceTable,
  col: SourceColumn,
  n: number,
  ctx: GenContext,
  cols: Map<string, Cell[]>,
  fkIndex: Map<string, Int32Array>,
): Cell[] {
  const rng = new Rng(hashSeed(ctx.seed, table.name, col.name));
  const gen: GenSpec = col.gen;
  const out: Cell[] = new Array<Cell>(n);
  const types = new Map(table.columns.map((c) => [c.name, c.type]));
  const earlier = (name: string): Cell[] => {
    const values = cols.get(name);
    if (!values) throw new Error(`${table.name}.${col.name} references "${name}", which is not an earlier column`);
    return values;
  };

  if ('seq' in gen) {
    const { prefix, pad, start } = gen.seq;
    for (let i = 0; i < n; i++) {
      const k = start + i;
      out[i] = isInt(col.type) ? k : `${prefix}${String(k).padStart(pad, '0')}`;
    }
  } else if ('choice' in gen) {
    const cum = cumulativeOf(gen.choice.weights ?? gen.choice.values.map(() => 1));
    for (let i = 0; i < n; i++) out[i] = gen.choice.values[rng.pickCumulative(cum)] ?? null;
  } else if ('bernoulli' in gen) {
    for (let i = 0; i < n; i++) out[i] = rng.chance(gen.bernoulli);
  } else if ('uniform' in gen) {
    const g = gen.uniform;
    for (let i = 0; i < n; i++) out[i] = finishNumber(rng.range(g.min, g.max), col, { decimals: g.decimals });
  } else if ('normal' in gen) {
    const g = gen.normal;
    for (let i = 0; i < n; i++) out[i] = finishNumber(rng.normal(g.mean, g.sd), col, g);
  } else if ('lognormal' in gen) {
    const g = gen.lognormal;
    for (let i = 0; i < n; i++) out[i] = finishNumber(rng.lognormal(g.mu, g.sigma), col, g);
  } else if ('poisson' in gen) {
    const g = gen.poisson;
    for (let i = 0; i < n; i++) out[i] = finishNumber(rng.poisson(g.lambda), col, g);
  } else if ('datetime' in gen || 'date' in gen) {
    const g = 'datetime' in gen ? gen.datetime : gen.date;
    const { days, cumulative } = dayTable(resolveDay(g.from, ctx.clock), resolveDay(g.to, ctx.clock), g.seasonality);
    const businessHours = 'datetime' in gen && gen.datetime.business_hours === true;
    for (let i = 0; i < n; i++) {
      const day = days[rng.pickCumulative(cumulative)] ?? 0;
      if (col.type === 'DATE') out[i] = day;
      else out[i] = day * 86_400 + (businessHours ? rng.int(8 * 3600, 18 * 3600 - 1) : rng.int(0, 86_399));
    }
  } else if ('date_offset' in gen) {
    const g = gen.date_offset;
    const src = earlier(g.from_column);
    const srcType = types.get(g.from_column);
    for (let i = 0; i < n; i++) {
      const v = src[i];
      if (typeof v !== 'number') {
        out[i] = null;
        continue;
      }
      const base = srcType === 'TIMESTAMP' ? Math.floor(v / 86_400) : v;
      const day = base + rng.int(g.days.min, g.days.max);
      out[i] = g.clamp_to_as_of && day > ctx.clock.asOfDay ? null : day;
    }
  } else if ('fk' in gen) {
    const parent = ctx.tables.get(gen.fk.table);
    if (!parent) throw new Error(`${table.name}.${col.name}: fk table ${gen.fk.table} is not generated yet`);
    const pIdx = parent.spec.columns.findIndex((c) => c.name === gen.fk.column);
    const pValues = parent.data[pIdx];
    if (!pValues) throw new Error(`${table.name}.${col.name}: fk column ${gen.fk.table}.${gen.fk.column} not found`);
    const m = parent.baseRows;
    const cum = gen.fk.dist === 'zipf' ? zipfCumulative(m, gen.fk.s) : null;
    const idx = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      // `sequential`: child i belongs to parent i (mod parent rows) — one child per parent.
      const j = gen.fk.dist === 'sequential' ? i % m : cum ? rng.pickCumulative(cum) : rng.int(0, m - 1);
      idx[i] = j;
      out[i] = pValues[j] ?? null;
    }
    fkIndex.set(col.name, idx);
  } else if ('derive_from' in gen) {
    const g = gen.derive_from;
    const idx = fkIndex.get(g.fk_column);
    const fkSpec = table.columns.find((c) => c.name === g.fk_column)?.gen;
    if (!idx || !fkSpec || !('fk' in fkSpec)) throw new Error(`${table.name}.${col.name}: derive_from needs an earlier fk column "${g.fk_column}"`);
    const parent = ctx.tables.get(fkSpec.fk.table) as GeneratedTable;
    const pValues = parent.data[parent.spec.columns.findIndex((c) => c.name === g.parent_column)];
    if (!pValues) throw new Error(`${table.name}.${col.name}: parent column ${fkSpec.fk.table}.${g.parent_column} not found`);
    for (let i = 0; i < n; i++) out[i] = pValues[idx[i] ?? 0] ?? null;
  } else if ('template' in gen) {
    const parts = gen.template.split(/(\{[a-z_][a-z0-9_]*\})/);
    const refs = parts.map((p) => (p.startsWith('{') ? { name: p.slice(1, -1), values: earlier(p.slice(1, -1)) } : null));
    for (let i = 0; i < n; i++) {
      out[i] = parts.map((p, k) => {
        const ref = refs[k];
        return ref ? formatCell(ref.values[i] ?? null, types.get(ref.name) ?? 'VARCHAR') : p;
      }).join('');
    }
  } else if ('person' in gen) {
    for (let i = 0; i < n; i++) {
      const first = rng.pick(FIRST_NAMES);
      const last = rng.pick(LAST_NAMES);
      out[i] = gen.person === 'first' ? first : gen.person === 'last' ? last : `${first} ${last}`;
    }
  } else if ('company' in gen) {
    for (let i = 0; i < n; i++) out[i] = `${rng.pick(COMPANY_STEMS)} ${rng.pick(COMPANY_SUFFIXES)}`;
  } else if ('address' in gen) {
    for (let i = 0; i < n; i++) out[i] = `${rng.int(10, 9899)} ${rng.pick(STREETS)}`;
  } else if ('email' in gen) {
    const first = earlier(gen.email.first);
    const last = earlier(gen.email.last);
    for (let i = 0; i < n; i++) out[i] = `${String(first[i]).toLowerCase()}.${String(last[i]).toLowerCase()}${i % 97}@${gen.email.domain}`;
  } else if ('phone' in gen) {
    // 555-01xx numbers are reserved for fiction.
    for (let i = 0; i < n; i++) out[i] = `+1-${rng.int(201, 989)}-555-01${String(rng.int(0, 99)).padStart(2, '0')}`;
  } else if ('formula' in gen) {
    const fn = compileFormula(gen.formula, new Set(cols.keys()));
    for (let i = 0; i < n; i++) {
      const v = fn((name) => (cols.get(name) as Cell[])[i] ?? null);
      out[i] = typeof v === 'number' ? finishNumber(v, col, gen) : v;
    }
  } else if ('const' in gen) {
    out.fill(gen.const);
  }

  if (col.null_pct && col.name !== table.key) {
    const nullRng = new Rng(hashSeed(ctx.seed, table.name, col.name, 'null'));
    const p = col.null_pct / 100;
    for (let i = 0; i < n; i++) if (nullRng.chance(p)) out[i] = null;
  }
  return out;
}

/** Generates base rows for one table (no plants, no noise). */
export function generateBase(table: SourceTable, ctx: GenContext): GeneratedTable {
  const n = table.rows[ctx.scale];
  const cols = new Map<string, Cell[]>();
  const fkIndex = new Map<string, Int32Array>();
  for (const col of table.columns) cols.set(col.name, generateColumn(table, col, n, ctx, cols, fkIndex));
  return {
    spec: table,
    data: table.columns.map((c) => cols.get(c.name) as Cell[]),
    fkIndex,
    ops: new Array<'I'>(n).fill('I'),
    loadedAt: new Array<number>(n).fill(0),
    baseRows: n,
  };
}

export { formatCell, isTemporal };
