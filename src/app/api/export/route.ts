import { db } from '@/lib/db';
import { auditBundle } from '@/lib/exports/audit-bundle';
import { evidencePack } from '@/lib/exports/evidence-pack';
import { getPack, hasPack } from '@/lib/packs/registry';
import { openLineage } from '@/lib/standards/openlineage';

export const dynamic = 'force-dynamic';

/** GET /api/export?kind=evidence|openlineage|audit&pack=&product= — governance exports (06 §8). Metadata only. */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const packId = url.searchParams.get('pack') ?? '';
  const productId = url.searchParams.get('product') ?? '';
  if (!hasPack(packId)) return new Response('Unknown pack', { status: 404 });
  const pack = getPack(packId);
  const product = await db().dataProduct.findUnique({ where: { id: productId } }).catch(() => null);
  if (kind !== 'audit' && (!product || product.packId !== packId)) return new Response('Unknown product', { status: 404 });
  if (kind === 'evidence') {
    const buf = await evidencePack(db(), pack, productId);
    return new Response(new Uint8Array(buf), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': `attachment; filename="${productId}-evidence-pack.docx"` } });
  }
  if (kind === 'openlineage') {
    return new Response(JSON.stringify(openLineage(pack, productId), null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${productId}-openlineage.json"` } });
  }
  if (kind === 'audit') {
    const b = await auditBundle(db(), packId);
    return new Response(new Uint8Array(b.zip), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${packId}-audit-bundle.zip"`, 'x-audit-chain': b.ok ? 'verified' : 'broken' } });
  }
  return new Response('Unknown export', { status: 400 });
}
