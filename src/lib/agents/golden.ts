/**
 * Golden records (10 §2): per scenario, the compiled SQL hash, rounded result rows, headline text and
 * per-persona variants. Deterministic for a given pack + seed + scale; timings and log ids are excluded.
 */
import { createHash } from 'node:crypto';
import type { Pack, Rubrics, Scenario } from '@/lib/packs/schema';
import { principalFor } from '@/lib/query/principal';
import type { QueryService } from '@/lib/query/query-service';
import { respondScripted } from './scripted/respond';
import type { AgentAnswer } from './types';

export interface GoldenVariant {
  kind: AgentAnswer['kind'];
  headline: string;
  rowFiltered?: boolean;
  masked?: string[];
}

export interface GoldenScenario extends GoldenVariant {
  agent: string;
  narrative: string;
  sqlHash?: string;
  columns?: string[];
  rows?: (string | number | boolean | null)[][];
  citations: string[];
  personas: Record<string, GoldenVariant>;
}

export interface GoldenFile {
  pack: string;
  version: string;
  scale: string;
  scenarios: Record<string, GoldenScenario>;
}

/** Rounds numbers to 6 significant digits so float noise never drifts a golden file. */
export function roundCell(v: unknown): string | number | boolean | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toPrecision(6)) : null;
  if (typeof v === 'bigint') return Number(v);
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  return String(v);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export function personaFor(pack: Pack, archetype: string) {
  const p = pack.personas.find((x) => x.archetype === archetype);
  if (!p) throw new Error(`Pack ${pack.manifest.id} has no archetype ${archetype} persona`);
  return principalFor(pack, p.id);
}

/** The reference persona golden numbers are recorded as (archetype D sees everything in clear). */
export const GOLDEN_ARCHETYPE = 'D';

function variant(a: AgentAnswer): GoldenVariant {
  return {
    kind: a.kind,
    headline: a.headline,
    ...(a.result ? { rowFiltered: a.result.rowFiltered, masked: [...a.result.maskedColumns].sort() } : {}),
  };
}

export async function goldenScenario(pack: Pack, rubrics: Rubrics, qs: QueryService, s: Scenario): Promise<{ golden: GoldenScenario; answer: AgentAnswer }> {
  const deps = { pack, rubrics, qs };
  const a = await respondScripted(s.agent, s.question, { ...deps, who: personaFor(pack, GOLDEN_ARCHETYPE) });
  const personas: Record<string, GoldenVariant> = {};
  for (const arch of Object.keys(s.personas_expect).sort()) {
    personas[arch] = variant(await respondScripted(s.agent, s.question, { ...deps, who: personaFor(pack, arch) }));
  }
  return {
    answer: a,
    golden: {
      agent: s.agent,
      ...variant(a),
      narrative: a.narrative,
      ...(a.result
        ? { sqlHash: sha(a.result.displaySql), columns: a.result.columns.map((c) => c.name), rows: a.result.rows.map((r) => r.map(roundCell)) }
        : {}),
      citations: a.citations.filter((c) => c.kind !== 'sql').map((c) => `${c.kind}:${c.ref}`),
      personas,
    },
  };
}

export async function computeGolden(pack: Pack, rubrics: Rubrics, qs: QueryService, scale: string): Promise<GoldenFile> {
  const scenarios: Record<string, GoldenScenario> = {};
  for (const s of pack.scenarios) scenarios[s.id] = (await goldenScenario(pack, rubrics, qs, s)).golden;
  return { pack: pack.manifest.id, version: pack.manifest.version, scale, scenarios };
}

/** Field-level differences between two golden files (for the drift report and category 11). */
export function diffGolden(expected: GoldenFile, actual: GoldenFile): string[] {
  const out: string[] = [];
  const ids = new Set([...Object.keys(expected.scenarios), ...Object.keys(actual.scenarios)]);
  for (const id of [...ids].sort()) {
    const e = expected.scenarios[id];
    const a = actual.scenarios[id];
    if (!e || !a) {
      out.push(`${id}: ${e ? 'missing from regenerated golden' : 'not in committed golden'}`);
      continue;
    }
    for (const key of new Set([...Object.keys(e), ...Object.keys(a)]) as Set<keyof GoldenScenario>) {
      if (JSON.stringify(e[key]) !== JSON.stringify(a[key])) out.push(`${id}.${key}: ${JSON.stringify(e[key])?.slice(0, 160)} → ${JSON.stringify(a[key])?.slice(0, 160)}`);
    }
  }
  return out;
}
