import Link from 'next/link';
import { ObjectQuality, ProductQuality } from '@/components/marketplace/product-quality';
import { copy } from '@/copy/en';
import { productForObject } from '@/lib/packs/lineage';
import type { Pack } from '@/lib/packs/schema';

/** Data quality for an object: a DATA_PRODUCTS view shows its product's quality; other objects their own rules. */
export async function QualityPanel({ pack, fqn }: { pack: Pack; fqn: string }) {
  const product = productForObject(pack, fqn);
  if (!product) return <ObjectQuality pack={pack} fqn={fqn} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {copy.explorer.productObject}{' '}
        <Link className="text-primary underline" href={`/${pack.manifest.id}/marketplace/products/${product.id}?tab=quality`}>
          {product.id} {product.name}
        </Link>
        .
      </p>
      <ProductQuality pack={pack} product={product} />
    </div>
  );
}
