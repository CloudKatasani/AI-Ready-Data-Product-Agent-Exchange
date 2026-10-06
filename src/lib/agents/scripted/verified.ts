/**
 * Verified-query path (ADR-0018): an active verified query whose question matches the user's question is
 * a known-good question → MetricQuery pair, so the scripted engine runs its query before free planning.
 * Only verified queries over metrics the agent covers are considered.
 */
import type { AgentManifest, Kpi, Pack, SemanticView, VerifiedQuery } from '@/lib/packs/schema';
import { expandSynonyms, normalise, type SynonymPair, synonymPairs, tokens } from './text';

export interface VerifiedMatch {
  vq: VerifiedQuery;
  kpi: Kpi;
  view: SemanticView;
  score: number;
}

interface Doc {
  vq: VerifiedQuery;
  vec: Map<string, number>;
  norm: number;
}

export class VerifiedQueryMatcher {
  private idf = new Map<string, number>();
  private docs: Doc[];
  private pairs: SynonymPair[];

  constructor(private readonly pack: Pack) {
    this.pairs = synonymPairs(pack);
    const raw = pack.verifiedQueries.filter((v) => v.status === 'active').map((vq) => ({ vq, toks: [...new Set(tokens(expandSynonyms(vq.question, this.pairs)))] }));
    const df = new Map<string, number>();
    for (const d of raw) for (const t of d.toks) df.set(t, (df.get(t) ?? 0) + 1);
    for (const [t, n] of df) this.idf.set(t, Math.log(1 + raw.length / n));
    this.docs = raw.map((d) => {
      const vec = new Map(d.toks.map((t) => [t, this.idf.get(t) ?? 0]));
      return { vq: d.vq, vec, norm: Math.sqrt([...vec.values()].reduce((a, b) => a + b * b, 0)) };
    });
  }

  /** Best verified query for the agent at or above `threshold` (exact question match scores 1). */
  best(agent: AgentManifest, question: string, threshold: number): VerifiedMatch | null {
    const covered = new Map(agent.kpi_coverage.flatMap((c) => {
      const k = this.pack.kpis.find((x) => x.id === c.kpi);
      return k ? [[k.metric, k] as const] : [];
    }));
    const qt = [...new Set(tokens(expandSynonyms(question, this.pairs)))];
    const qv = new Map(qt.map((t) => [t, this.idf.get(t) ?? 0.4]));
    const qn = Math.sqrt([...qv.values()].reduce((a, b) => a + b * b, 0)) || 1;
    const nq = normalise(question);
    let best: VerifiedMatch | null = null;
    for (const d of this.docs) {
      const kpi = d.vq.query.metrics.map((m) => covered.get(m)).find(Boolean);
      if (!kpi) continue;
      const view = this.pack.semantic.find((v) => v.name === d.vq.query.view);
      if (!view) continue;
      let dot = 0;
      for (const [t, w] of qv) dot += w * (d.vec.get(t) ?? 0);
      // Only an exact question scores 1; a token-identical rewording stays just below it.
      const score = normalise(d.vq.question) === nq ? 1 : Math.min(0.999, dot / (qn * (d.norm || 1)));
      if (score >= threshold && (!best || score > best.score || (score === best.score && d.vq.id < best.vq.id))) best = { vq: d.vq, kpi, view, score };
    }
    return best;
  }
}

const matchers = new WeakMap<Pack, VerifiedQueryMatcher>();
export function verifiedMatcherFor(pack: Pack): VerifiedQueryMatcher {
  let m = matchers.get(pack);
  if (!m) matchers.set(pack, (m = new VerifiedQueryMatcher(pack)));
  return m;
}
