/** TF-IDF cosine matcher over scenarios + paraphrases (ported from AI-Ready `matcher.ts`). */
import type { Pack, Scenario } from '@/lib/packs/schema';
import { expandSynonyms, normalise, type SynonymPair, synonymPairs, tokens } from './text';

export interface MatchResult {
  scenario: Scenario;
  score: number;
}

export class Matcher {
  private idf = new Map<string, number>();
  private docs: { scenario: Scenario; vec: Map<string, number>; norm: number }[] = [];
  private pairs: SynonymPair[];

  constructor(pack: Pack, overlays: SynonymPair[] = []) {
    this.pairs = synonymPairs(pack, overlays);
    const raw = pack.scenarios.flatMap((s) => {
      const kpiNames = pack.kpis.filter((k) => s.query?.metrics.includes(k.metric)).map((k) => k.name).join(' ');
      return [s.question, ...s.paraphrases].map((q) => ({ scenario: s, toks: [...new Set(tokens(expandSynonyms(`${q} ${kpiNames}`, this.pairs)))] }));
    });
    const df = new Map<string, number>();
    for (const d of raw) for (const t of d.toks) df.set(t, (df.get(t) ?? 0) + 1);
    for (const [t, n] of df) this.idf.set(t, Math.log(1 + raw.length / n));
    this.docs = raw.map((d) => {
      const vec = new Map(d.toks.map((t) => [t, this.idf.get(t) ?? 0]));
      return { scenario: d.scenario, vec, norm: Math.sqrt([...vec.values()].reduce((a, b) => a + b * b, 0)) };
    });
  }

  /** Scenarios ranked by best cosine over their question and paraphrases; exact question match scores 1. */
  rank(query: string, agentId?: string): MatchResult[] {
    const qt = [...new Set(tokens(expandSynonyms(query, this.pairs)))];
    const qv = new Map(qt.map((t) => [t, this.idf.get(t) ?? 0.4]));
    const qn = Math.sqrt([...qv.values()].reduce((a, b) => a + b * b, 0)) || 1;
    const best = new Map<string, MatchResult>();
    const nq = normalise(query);
    for (const d of this.docs) {
      if (agentId && d.scenario.agent !== agentId) continue;
      let dot = 0;
      for (const [t, w] of qv) dot += w * (d.vec.get(t) ?? 0);
      let score = dot / (qn * (d.norm || 1));
      if (normalise(d.scenario.question) === nq || d.scenario.paraphrases.some((p) => normalise(p) === nq)) score = 1;
      const cur = best.get(d.scenario.id);
      if (!cur || score > cur.score) best.set(d.scenario.id, { scenario: d.scenario, score });
    }
    return [...best.values()].sort((a, b) => b.score - a.score || a.scenario.id.localeCompare(b.scenario.id));
  }
}
