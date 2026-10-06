/**
 * Catalog search (01 §M3): BM25 (MiniSearch) over products, agents and KPIs. Each document carries its
 * KPI names, metric synonyms and glossary terms, so a business phrase finds the governed thing it means
 * (a KPI synonym finds the product exposing that KPI and the KPI itself).
 */
import MiniSearch from 'minisearch';
import { expandQuery } from '@/lib/packs/doc-search';
import type { Kpi, Pack } from '@/lib/packs/schema';

export interface CatalogHit {
  kind: 'product' | 'agent' | 'kpi';
  id: string;
  name: string;
  score: number;
  terms: string[];
}

interface Doc {
  id: string;
  kind: CatalogHit['kind'];
  ref: string;
  name: string;
  text: string;
  vocabulary: string;
}

function kpiVocabulary(pack: Pack, kpi: Kpi): string[] {
  const view = pack.semantic.find((v) => v.metrics.some((m) => m.name === kpi.metric));
  const metric = view?.metrics.find((m) => m.name === kpi.metric);
  const term = pack.glossary.find((t) => t.id === kpi.term);
  const syn = pack.synonyms.filter((s) => s.maps_to.ref === kpi.metric || s.maps_to.ref === kpi.term).flatMap((s) => [s.term, ...s.synonyms]);
  return [kpi.name, metric?.label ?? '', ...(metric?.synonyms ?? []), ...(term ? [term.name, ...term.synonyms] : []), ...syn].filter(Boolean);
}

const indexes = new WeakMap<Pack, MiniSearch<Doc>>();

function indexFor(pack: Pack): MiniSearch<Doc> {
  let idx = indexes.get(pack);
  if (idx) return idx;
  idx = new MiniSearch<Doc>({ fields: ['name', 'text', 'vocabulary'], storeFields: ['kind', 'ref', 'name'], searchOptions: { boost: { name: 3, vocabulary: 2 }, prefix: true, fuzzy: 0.15, combineWith: 'OR' } });
  const kpiVocab = new Map(pack.kpis.map((k) => [k.id, kpiVocabulary(pack, k)]));
  idx.addAll([
    ...pack.products.map((p) => ({ id: `product:${p.id}`, kind: 'product' as const, ref: p.id, name: p.name, text: `${p.domain} ${p.description} ${p.purpose} ${p.sample_questions.join(' ')}`, vocabulary: p.kpis.flatMap((k) => kpiVocab.get(k) ?? []).join(' · ') })),
    ...pack.agents.map((a) => ({ id: `agent:${a.id}`, kind: 'agent' as const, ref: a.id, name: a.name, text: `${a.domain} ${a.capability}`, vocabulary: a.kpi_coverage.flatMap((c) => kpiVocab.get(c.kpi) ?? []).join(' · ') })),
    ...pack.kpis.map((k) => ({ id: `kpi:${k.id}`, kind: 'kpi' as const, ref: k.id, name: k.name, text: k.definition, vocabulary: (kpiVocab.get(k.id) ?? []).join(' · ') })),
  ]);
  indexes.set(pack, idx);
  return idx;
}

export function searchCatalog(pack: Pack, query: string, limit = 30): CatalogHit[] {
  if (!query.trim()) return [];
  return indexFor(pack)
    .search(expandQuery(pack, query))
    .slice(0, limit)
    .map((r) => ({ kind: r.kind as CatalogHit['kind'], id: String(r.ref), name: String(r.name), score: Math.round(r.score * 100) / 100, terms: r.terms }));
}
