/** Audit bundle (.zip): NDJSON of the pack's hash-chained events plus a manifest with the verification result. */
import type { PrismaClient } from '@prisma/client';
import { chainOrder, verifyChain } from '@/lib/db/audit';
import { zip } from './zip';

export async function auditBundle(client: PrismaClient, packId: string): Promise<{ zip: Buffer; ok: boolean; events: number }> {
  const events = await client.auditEvent.findMany({ where: { packId } });
  const ordered = chainOrder(events) ?? events;
  const check = verifyChain(events);
  const ndjson = ordered.map((e) => JSON.stringify({ id: e.id, at: e.createdAt.toISOString(), actorType: e.actorType, actorId: e.actorId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, detail: JSON.parse(e.detailJson) as unknown, prevHash: e.prevHash, hash: e.hash })).join('\n');
  const manifest = { packId, events: events.length, chain: check.ok ? 'verified' : 'broken', brokenAt: check.brokenAt ?? null, algorithm: 'sha256(prevHash + canonicalJson(event))', head: ordered.at(-1)?.hash ?? null };
  return { zip: zip([{ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) }, { name: 'events.ndjson', data: `${ndjson}\n` }]), ok: check.ok, events: events.length };
}
