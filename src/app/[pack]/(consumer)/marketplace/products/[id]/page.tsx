import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkTabs } from '@/components/explorer/tabs';
import { AccessChip, QualityRing, SensitivityChips, StatusChip } from '@/components/marketplace/chips';
import { RequestAccess } from '@/components/marketplace/request-access';
import { buttonVariants } from '@/components/ui/button';
import { copy } from '@/copy/en';
import { productCard } from '@/lib/marketplace/catalog';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { catalogState } from '@/lib/presenter/marketplace';
import { activePrincipal } from '../../../../_server/session';
import { previewAccess, requestAccess } from '../../actions';
import { ProductTab, TABS, type Tab } from './_tabs';

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ pack: string; id: string }>; searchParams: Promise<{ tab?: string; request?: string }> }) {
  const { pack: packId, id: raw } = await params;
  const sp = await searchParams;
  const id = decodeURIComponent(raw);
  const pack = getPack(packId);
  const product = pack.products.find((p) => p.id === id);
  if (!product) notFound();
  const rubrics = getRubrics();
  const who = await activePrincipal(pack);
  const state = await catalogState(pack, who.personaId);
  const card = productCard(pack, rubrics, product, state, who);
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'overview';
  const base = `/${packId}/marketplace/products/${product.id}`;
  const canRequest = card.access === 'Restricted' || card.access === 'Requestable';

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start gap-4">
        <QualityRing score={card.quality?.score ?? null} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            <Link href={`/${packId}/marketplace`} className="hover:underline">
              {copy.marketplace.title}
            </Link>{' '}
            / {product.domain}
          </p>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-muted-foreground">{product.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <StatusChip status={card.status} />
            <span className="rounded-full border border-border px-2 py-0.5">
              {product.id} · v{card.version}
            </span>
            {card.quality && <span className="rounded-full border border-border px-2 py-0.5 capitalize">{card.quality.tier}</span>}
            <SensitivityChips classes={card.sensitivity} />
            <AccessChip access={card.access} />
          </div>
        </div>
        {canRequest && (
          <Link href={`${base}?tab=${tab}&request=1`} className={buttonVariants()} data-testid="request-access">
            {copy.product.requestAccess}
          </Link>
        )}
      </header>
      {sp.request === '1' && (
        <RequestAccess
          packId={packId}
          productId={product.id}
          productName={product.name}
          purposes={rubrics.access.purposes}
          durations={rubrics.access.durations_days}
          defaultDuration={rubrics.access.default_duration_days}
          closeHref={`${base}?tab=${tab}`}
          preview={previewAccess.bind(null, packId, product.id)}
          submit={requestAccess.bind(null, packId)}
        />
      )}
      <LinkTabs label={product.name} active={tab} tabs={TABS.map((t) => ({ id: t, label: copy.product.tabs[t], href: `${base}?tab=${t}` }))} />
      <ProductTab tab={tab} pack={pack} product={product} card={card} who={who} />
    </div>
  );
}
