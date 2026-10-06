import { productObjects } from '@/lib/lifecycle/quality';
import { getPack, hasPack } from '@/lib/packs/registry';
import { describeObject } from '@/lib/presenter/governed';
import { catalogState } from '@/lib/presenter/marketplace';
import { odcsContract, odcsYaml } from '@/lib/standards/odcs';

export const dynamic = 'force-dynamic';

/** GET /api/contract?pack=&product= — the product's ODCS v3 data contract as YAML (metadata only, no rows). */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const packId = url.searchParams.get('pack') ?? '';
  const productId = url.searchParams.get('product') ?? '';
  if (!hasPack(packId)) return new Response('Unknown pack', { status: 404 });
  const pack = getPack(packId);
  const product = pack.products.find((p) => p.id === productId);
  if (!product) return new Response('Unknown product', { status: 404 });
  const live = (await catalogState(pack, '')).live.get(product.id);
  const cols: Record<string, { name: string; type: string; nullable: boolean }[]> = {};
  for (const fqn of productObjects(pack, product).filter((o) => !o.startsWith('RAW_BRONZE.'))) cols[fqn] = await describeObject(packId, fqn);
  const yaml = odcsYaml(odcsContract(pack, product, live?.version ?? product.version, live?.status ?? product.initial_status, cols));
  return new Response(yaml, { headers: { 'content-type': 'application/yaml; charset=utf-8', 'content-disposition': `attachment; filename="${product.id}-contract.yaml"` } });
}
