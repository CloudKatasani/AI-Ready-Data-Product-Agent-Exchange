import MiniSearch from 'minisearch';
import { chunkDocument } from './chunk';
import type { Pack } from './schema';

export interface DocHit {
  docId: string;
  title: string;
  chunk: number;
  text: string;
  score: number;
  terms: string[];
}

interface ChunkDoc {
  id: string;
  docId: string;
  title: string;
  chunk: number;
  text: string;
}

const indexes = new Map<string, MiniSearch<ChunkDoc>>();

function indexFor(pack: Pack): MiniSearch<ChunkDoc> {
  let idx = indexes.get(pack.manifest.id);
  if (!idx) {
    idx = new MiniSearch<ChunkDoc>({ fields: ['title', 'text'], storeFields: ['docId', 'title', 'chunk', 'text'], searchOptions: { boost: { title: 2 }, prefix: true, fuzzy: 0.15 } });
    idx.addAll(pack.docs.flatMap((d) => chunkDocument(d.body).map((text, i) => ({ id: `${d.meta.id}#${i + 1}`, docId: d.meta.id, title: d.meta.title, chunk: i + 1, text }))));
    indexes.set(pack.manifest.id, idx);
  }
  return idx;
}

/** Expands a query with pack + glossary synonyms (05 §7): a matching synonym adds its canonical term. */
export function expandQuery(pack: Pack, query: string): string {
  const q = query.toLowerCase();
  const extra = new Set<string>();
  for (const s of pack.synonyms) if ([s.term, ...s.synonyms].some((x) => q.includes(x.toLowerCase()))) extra.add(s.term);
  for (const t of pack.glossary) if ([t.name, ...t.synonyms].some((x) => q.includes(x.toLowerCase()))) extra.add(t.name);
  return [query, ...extra].join(' ');
}

/** BM25 search over chunked context documents (simulated Cortex Search). */
export function searchDocuments(pack: Pack, query: string, k = 5, corpora?: string[]): DocHit[] {
  if (!query.trim()) return [];
  return indexFor(pack)
    .search(expandQuery(pack, query), corpora ? { filter: (r) => corpora.includes(String(r.docId)) } : undefined)
    .slice(0, k)
    .map((r) => ({ docId: String(r.docId), title: String(r.title), chunk: Number(r.chunk), text: String(r.text), score: Math.round(r.score * 100) / 100, terms: r.terms }));
}
