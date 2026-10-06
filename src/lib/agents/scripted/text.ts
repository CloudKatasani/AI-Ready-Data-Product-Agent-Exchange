/** Text normalisation, stemming and synonym expansion (ported from AI-Ready `agents/engine/matcher.ts`). */
import type { Pack } from '@/lib/packs/schema';

const STOP = new Set(
  'a an the of in on for by to and or is are was were what which how many much our we show me give tell with this that last do does did be it its from at as per vs than please can you i my'.split(' '),
);

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%$ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const stem = (w: string) => w.replace(/ies$/, 'y').replace(/(ing|ers|er|es|(?<!s)s)$/, '');

export function tokens(s: string): string[] {
  return normalise(s)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/** True when `phrase` occurs in `text` as whole words (both normalised). */
export function mentions(text: string, phrase: string): boolean {
  const p = normalise(phrase);
  return p.length > 0 && ` ${normalise(text)} `.includes(` ${p} `);
}

/** Synonym pairs from pack synonyms, glossary terms, metric/dimension synonyms (+ active overlays). */
export interface SynonymPair {
  phrase: string;
  canonical: string;
}

export function synonymPairs(pack: Pack, overlays: SynonymPair[] = []): SynonymPair[] {
  const out: SynonymPair[] = [...overlays];
  for (const s of pack.synonyms) for (const syn of s.synonyms) out.push({ phrase: syn, canonical: s.term });
  for (const g of pack.glossary) for (const syn of g.synonyms) out.push({ phrase: syn, canonical: g.name });
  for (const v of pack.semantic) {
    for (const m of v.metrics) for (const syn of m.synonyms) out.push({ phrase: syn, canonical: m.label });
    for (const d of v.dimensions) for (const syn of d.synonyms) out.push({ phrase: syn, canonical: d.label ?? d.name });
  }
  return out;
}

export function expandSynonyms(text: string, pairs: SynonymPair[]): string {
  const t = ` ${normalise(text)} `;
  const add = new Set<string>();
  for (const p of pairs) if (t.includes(` ${normalise(p.phrase)} `)) add.add(normalise(p.canonical));
  return `${t.trim()} ${[...add].join(' ')}`.trim();
}
