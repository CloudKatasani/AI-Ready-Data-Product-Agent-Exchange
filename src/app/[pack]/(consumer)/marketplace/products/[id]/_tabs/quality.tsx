import { LineagePanelForId } from './lineage';
import { ProductQuality } from '@/components/marketplace/product-quality';
import type { TabProps } from '.';

export async function QualityTab({ pack, product, card }: TabProps) {
  return <ProductQuality pack={pack} product={product} score={card.quality?.score ?? null} />;
}

export function LineageTab({ pack, product }: TabProps) {
  return <LineagePanelForId pack={pack} id={product.id} />;
}
