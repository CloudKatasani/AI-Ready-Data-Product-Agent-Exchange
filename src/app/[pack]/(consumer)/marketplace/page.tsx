import Link from 'next/link';
import { LinkTabs } from '@/components/explorer/tabs';
import { AgentCardView } from '@/components/marketplace/agent-card';
import { DemandBoard } from '@/components/marketplace/demand-board';
import { MeshGraph } from '@/components/marketplace/mesh-graph';
import { ProductCardView } from '@/components/marketplace/product-card';
import { copy } from '@/copy/en';
import { db } from '@/lib/db';
import { agentCard, type CatalogFilters, filterProducts, productCard, productFacets } from '@/lib/marketplace/catalog';
import { listDemand } from '@/lib/marketplace/demand';
import { agentMesh, blastRadius, dataMesh } from '@/lib/marketplace/mesh';
import { searchCatalog } from '@/lib/marketplace/search';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { catalogState } from '@/lib/presenter/marketplace';
import { activePrincipal } from '../../_server/session';
import { CompareTable } from './_parts/compare';
import { submitNeed, vote } from './actions';

const TABS = ['all', 'products', 'agents', 'demand', 'mesh', 'compare'] as const;
type Tab = (typeof TABS)[number];
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function MarketplacePage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<SP> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const rubrics = getRubrics();
  const who = await activePrincipal(pack);
  const state = await catalogState(pack, who.personaId);
  const tab: Tab = (TABS as readonly string[]).includes(one(sp.tab) ?? '') ? (one(sp.tab) as Tab) : 'all';
  const q = one(sp.q)?.slice(0, 200) ?? '';
  const filters: CatalogFilters = {
    domain: one(sp.domain) || undefined,
    status: one(sp.status) || undefined,
    tier: one(sp.tier) || undefined,
    kpi: one(sp.kpi) || undefined,
    sensitivity: one(sp.sensitivity) || undefined,
    pattern: one(sp.pattern) || undefined,
    owner: one(sp.owner) || undefined,
    mine: one(sp.mine) === '1',
    hasAgent: one(sp.hasAgent) === '1',
  };
  const compare = [sp.compare ?? []].flat().filter((id) => pack.products.some((p) => p.id === id)).slice(0, 3);

  const allProducts = pack.products.map((p) => productCard(pack, rubrics, p, state, who));
  const hits = q ? searchCatalog(pack, q) : [];
  const rank = new Map(hits.map((h, i) => [`${h.kind}:${h.id}`, i]));
  const byRank = <T extends { kind: string; id: string }>(xs: T[]) => (q ? xs.filter((x) => rank.has(`${x.kind}:${x.id}`)).sort((a, b) => (rank.get(`${a.kind}:${a.id}`) ?? 0) - (rank.get(`${b.kind}:${b.id}`) ?? 0)) : xs);
  const products = byRank(filterProducts(allProducts, filters));
  const agents = byRank(pack.agents.map((a) => agentCard(pack, a, who)));
  const kpiHits = hits.filter((h) => h.kind === 'kpi');
  const tabHref = (t: Tab) => `/${packId}/marketplace?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{copy.marketplace.title}</h1>
        <p className="text-muted-foreground">{copy.marketplace.intro}</p>
      </header>
      <form method="get" className="flex gap-2" role="search">
        <input type="hidden" name="tab" value={tab === 'demand' || tab === 'mesh' || tab === 'compare' ? 'all' : tab} />
        <label htmlFor="mk-q" className="sr-only">
          {copy.marketplace.search}
        </label>
        <input id="mk-q" name="q" defaultValue={q} placeholder={copy.marketplace.search} className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3" data-testid="catalog-search" />
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          {copy.marketplace.searchButton}
        </button>
      </form>
      <LinkTabs label={copy.marketplace.title} active={tab} tabs={TABS.map((t) => ({ id: t, label: copy.marketplace.tabs[t], href: tabHref(t) }))} />

      {(tab === 'all' || tab === 'products' || tab === 'agents') && (
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <form method="get" className="flex flex-col gap-3 text-sm" aria-label={copy.marketplace.filters}>
            <input type="hidden" name="tab" value={tab} />
            {q && <input type="hidden" name="q" value={q} />}
            {productFacets(allProducts).map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                {copy.marketplace.facets[f.key as keyof typeof copy.marketplace.facets]}
                <select name={f.key} defaultValue={String(filters[f.key] ?? '')} className="h-9 rounded-md border border-border bg-surface px-2">
                  <option value="">{copy.marketplace.any}</option>
                  {f.values.map((v) => (
                    <option key={v.value} value={v.value}>
                      {f.key === 'status' ? (copy.marketplace.status[v.value as keyof typeof copy.marketplace.status] ?? v.label) : v.label} ({v.count})
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="inline-flex min-h-[24px] items-center gap-2">
              <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine} className="size-4" /> {copy.marketplace.mine}
            </label>
            <label className="inline-flex min-h-[24px] items-center gap-2">
              <input type="checkbox" name="hasAgent" value="1" defaultChecked={filters.hasAgent} className="size-4" /> {copy.marketplace.hasAgent}
            </label>
            <div className="flex gap-2">
              <button type="submit" className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground">
                {copy.marketplace.apply}
              </button>
              <Link href={tabHref(tab)} className="inline-flex h-9 items-center rounded-md border border-border px-3">
                {copy.marketplace.clear}
              </Link>
            </div>
          </form>
          <div className="flex flex-col gap-6">
            {kpiHits.length > 0 && (
              <section aria-labelledby="kpi-hits-h" data-testid="kpi-hits">
                <h2 id="kpi-hits-h" className="mb-2 text-sm font-semibold text-muted-foreground">
                  {copy.marketplace.kpiHits}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {kpiHits.map((k) => (
                    <li key={k.id} data-kpi={k.id} className="rounded-full border border-primary/40 px-3 py-1 text-sm">
                      {k.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {tab !== 'agents' && (
              <form method="get" action={`/${packId}/marketplace`} className="flex flex-col gap-3">
                <input type="hidden" name="tab" value="compare" />
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">
                    {copy.marketplace.tabs.products} <span className="text-sm font-normal text-muted-foreground">({products.length})</span>
                  </h2>
                  <button type="submit" className="ml-auto h-8 rounded-md border border-border px-3 text-sm">
                    {copy.marketplace.compareRun}
                  </button>
                </div>
                {products.length === 0 ? (
                  <p className="text-muted-foreground">{copy.marketplace.noResults}</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {products.map((c) => (
                      <li key={c.id}>
                        <ProductCardView card={c} packId={packId} compareChecked={compare.includes(c.id)} />
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            )}
            {tab !== 'products' && (
              <section className="flex flex-col gap-3" aria-labelledby="agents-h">
                <h2 id="agents-h" className="text-base font-semibold">
                  {copy.marketplace.tabs.agents} <span className="text-sm font-normal text-muted-foreground">({agents.length})</span>
                </h2>
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {agents.map((c) => (
                    <li key={c.id}>
                      <AgentCardView card={c} packId={packId} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'compare' && <CompareTable cards={allProducts.filter((c) => compare.includes(c.id))} pack={pack} />}

      {tab === 'demand' && (
        <section className="flex flex-col gap-3">
          <p className="text-muted-foreground">{copy.marketplace.demand.intro}</p>
          <DemandBoard packId={packId} items={await safeDemand(packId, who.personaId)} vote={vote.bind(null, packId)} submit={submitNeed.bind(null, packId)} />
        </section>
      )}

      {tab === 'mesh' && <MeshSection packId={packId} />}
    </div>
  );
}

async function safeDemand(packId: string, personaId: string) {
  try {
    return await listDemand(db(), packId, personaId);
  } catch {
    return [];
  }
}

function MeshSection({ packId }: { packId: string }) {
  const pack = getPack(packId);
  const radius = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, (() => {
    const r = blastRadius(pack, id);
    return [...r.products, ...r.agents].filter((x) => x !== id);
  })()]));
  const names = Object.fromEntries([...pack.products.map((p) => [p.id, p.name]), ...pack.agents.map((a) => [a.id, a.name])]);
  const dm = dataMesh(pack);
  const am = agentMesh(pack);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="dm-h">
        <h2 id="dm-h" className="mb-2 text-base font-semibold">
          {copy.marketplace.mesh.data}
        </h2>
        <MeshGraph label={copy.marketplace.mesh.data} nodes={dm.nodes} edges={dm.edges} radius={radius(dm.nodes.map((n) => n.id))} names={names} />
      </section>
      <section aria-labelledby="am-h">
        <h2 id="am-h" className="mb-2 text-base font-semibold">
          {copy.marketplace.mesh.agent}
        </h2>
        <MeshGraph label={copy.marketplace.mesh.agent} nodes={am.nodes} edges={am.edges} radius={radius(am.nodes.map((n) => n.id))} names={names} />
      </section>
    </div>
  );
}
