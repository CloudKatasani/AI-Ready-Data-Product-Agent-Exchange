/**
 * Migration coverage (ported from AI-Ready `ext/coverage.ts`): each Bronze source table's furthest level,
 * from the pack lineage plus live product and agent status, and "Simulate +N weeks" along the roadmap.
 * Pure; live status is passed in.
 */
import type { Pack } from '@/lib/packs/schema';
import { layout, PHASES } from './roadmap';

export const LEVELS = [
  { n: 0, name: 'Not started', rule: 'In the source inventory only' },
  { n: 1, name: 'Landed', rule: 'Present in RAW_BRONZE with CDC running' },
  { n: 2, name: 'Curated', rule: 'Feeds a Silver object' },
  { n: 3, name: 'Modelled', rule: 'Feeds a Gold dimension or fact' },
  { n: 4, name: 'Meaningful', rule: 'Its Gold objects are in a semantic view with glossary-mapped metrics' },
  { n: 5, name: 'Productized', rule: 'Part of a certified data product' },
  { n: 6, name: 'Agent-ready', rule: 'Used by a production agent' },
] as const;

export interface CoverageRow {
  id: string;
  system: string;
  levelNow: number;
  blocker?: string;
}

/** Every object downstream of `start` (inclusive), following `upstream` links. */
export function downstreamOf(pack: Pack, start: string): Set<string> {
  const out = new Set<string>([start]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of pack.objects) {
      if (out.has(o.fqn) || !o.upstream.some((u) => out.has(u))) continue;
      out.add(o.fqn);
      grew = true;
    }
  }
  return out;
}

export function coverage(pack: Pack, productStatus: (id: string) => string): CoverageRow[] {
  return pack.sources.map((s) => {
    const fqn = `RAW_BRONZE.${s.name}`;
    const down = downstreamOf(pack, fqn);
    const silver = [...down].some((f) => f.startsWith('CURATED_SILVER.'));
    const gold = [...down].filter((f) => f.startsWith('CONFORMED_GOLD.'));
    const views = pack.semantic.filter((v) => v.tables.some((t) => gold.includes(t.fqn)) && v.metrics.some((m) => pack.glossary.some((g) => g.id === m.term)));
    const products = pack.products.filter((p) => (p.semantic_view && views.some((v) => v.name === p.semantic_view)) || p.upstream.some((u) => down.has(u)));
    const certified = products.filter((p) => productStatus(p.id) === 'CERTIFIED');
    const agents = pack.agents.filter((a) => a.status === 'PRODUCTION' && a.products.some((b) => certified.some((p) => p.id === b.id)));
    const level = agents.length ? 6 : certified.length ? 5 : views.length ? 4 : gold.length ? 3 : silver ? 2 : 1;
    const blocker = level === 4 ? 'No certified product uses it yet' : level === 3 ? 'Not in a semantic view' : level === 5 ? 'No production agent answers from it' : undefined;
    return { id: fqn, system: s.system, levelNow: level, ...(blocker ? { blocker } : {}) };
  });
}

/** Count of tables whose furthest level is exactly n (n = 0..6). */
export function levelHistogram(rows: { levelNow: number }[]): number[] {
  const h = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) h[r.levelNow] = (h[r.levelNow] ?? 0) + 1;
  return h;
}

/** Level each roadmap phase is expected to bring tables to (phase 0 setup … phase 6 scale). */
export const PHASE_LEVEL = [1, 2, 3, 4, 5, 6, 6];

/** "Simulate +N weeks": advance along the roadmap and lift tables one level per 4 weeks up to the reached phase's cap. */
export function simulate(rows: CoverageRow[], weeks: number, phaseNow: number, durations: Record<number, number> = {}): { rows: CoverageRow[]; phase: number } {
  if (weeks <= 0) return { rows, phase: phaseNow };
  const placed = layout(durations);
  const startWeek = placed[phaseNow]?.start ?? 0;
  const target = startWeek + weeks;
  const phase = placed.filter((p) => p.start <= target).pop()?.id ?? phaseNow;
  const cap = PHASE_LEVEL[Math.min(phase, PHASES.length - 1)] ?? 6;
  const steps = Math.floor(weeks / 4);
  return {
    phase,
    rows: rows.map((r) => {
      if (r.levelNow >= cap) return r;
      const levelNow = Math.min(cap, r.levelNow + steps);
      const { blocker, ...rest } = r;
      return levelNow >= cap ? { ...rest, levelNow } : { ...rest, levelNow, ...(blocker ? { blocker } : {}) };
    }),
  };
}
