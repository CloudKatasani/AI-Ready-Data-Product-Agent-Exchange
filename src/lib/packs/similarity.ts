/**
 * Duplicate detection (06 §7, 01 §M3): TF-IDF cosine similarity of a need against existing products,
 * agents (with their scenario questions) and open demand. Pure over the pack.
 */
import type { Pack, Rubrics } from './schema';

const STOP = new Set('a an and are as at be by for from how in is it of on or our that the to was what which with we our per'.split(' '));
const terms = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));

function tfidf(docs: string[][]): Map<string, number>[] {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  return docs.map((d) => {
    const v = new Map<string, number>();
    for (const t of d) v.set(t, (v.get(t) ?? 0) + 1);
    for (const [t, n] of v) v.set(t, n * Math.log(1 + docs.length / (df.get(t) ?? 1)));
    return v;
  });
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [t, x] of a) dot += x * (b.get(t) ?? 0);
  const n = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, x) => s + x * x, 0));
  const d = n(a) * n(b);
  return d ? dot / d : 0;
}

export interface DuplicateCandidate {
  kind: 'product' | 'agent' | 'demand';
  id: string;
  name: string;
  similarity: number;
}

/**
 * Per product: how well the asked questions match the curated scenario questions (and paraphrases) that
 * product already answers — the mean of the two best question matches. 1.0 = asked verbatim.
 */
export function questionMatchByProduct(pack: Pack, questions: string[]): Map<string, number> {
  const asked = questions.map((q) => q.trim()).filter(Boolean);
  const out = new Map<string, number>();
  if (!asked.length) return out;
  const scen = pack.scenarios.filter((s) => s.query).flatMap((s) => [s.question, ...s.paraphrases].map((q) => ({ q, view: s.query?.view })));
  const vecs = tfidf([...asked.map(terms), ...scen.map((x) => terms(x.q))]);
  for (const p of pack.products.filter((x) => x.semantic_view)) {
    const best = asked.map((_, i) => Math.max(0, ...scen.map((x, j) => (x.view === p.semantic_view ? cosine(vecs[i] ?? new Map(), vecs[asked.length + j] ?? new Map()) : 0)))).sort((a, b) => b - a);
    const top = best.slice(0, 2);
    out.set(p.id, top.reduce((a, b) => a + b, 0) / Math.max(1, top.length));
  }
  return out;
}

/** Existing products, agents and demand items similar to a text (similarity ≥ rubric threshold). */
export function duplicateCandidates(pack: Pack, rubrics: Rubrics, text: string, demand: { id: string; title: string; description: string }[] = [], questions: string[] = []): DuplicateCandidate[] {
  const qm = questionMatchByProduct(pack, questions);
  const corpus: { kind: DuplicateCandidate['kind']; id: string; name: string; text: string }[] = [
    ...pack.products.map((p) => ({ kind: 'product' as const, id: p.id, name: p.name, text: `${p.name} ${p.description} ${p.purpose} ${p.decision.decision} ${p.sample_questions.join(' ')} ${pack.scenarios.filter((s) => pack.agents.find((a) => a.id === s.agent)?.products.some((b) => b.id === p.id)).map((s) => s.question).join(' ')}` })),
    ...pack.agents.map((a) => ({ kind: 'agent' as const, id: a.id, name: a.name, text: `${a.name} ${a.capability} ${pack.scenarios.filter((s) => s.agent === a.id).map((s) => s.question).join(' ')}` })),
    ...demand.map((d) => ({ kind: 'demand' as const, id: d.id, name: d.title, text: `${d.title} ${d.description}` })),
  ];
  const vecs = tfidf([terms(text), ...corpus.map((c) => terms(c.text))]);
  const q = vecs[0] ?? new Map();
  return corpus
    .map((c, i) => ({ kind: c.kind, id: c.id, name: c.name, similarity: Math.round(Math.max(cosine(q, vecs[i + 1] ?? new Map()), qm.get(c.id) ?? 0) * 100) / 100 }))
    .filter((c) => c.similarity >= rubrics.intake.duplicate_similarity * 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}
