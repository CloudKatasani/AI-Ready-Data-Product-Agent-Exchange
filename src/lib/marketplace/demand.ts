/**
 * Demand board (01 §M3): requests for products/agents that don't exist yet. Voting is one vote per
 * persona. Submitting runs a duplicate check (TF-IDF cosine) against existing products, agents and open
 * demand, using the rubric's intake similarity threshold.
 */
import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import type { Pack } from '@/lib/packs/schema';

export { duplicateCandidates, type DuplicateCandidate } from '@/lib/packs/similarity';

export async function listDemand(prisma: PrismaClient, packId: string, personaId: string) {
  const items = await prisma.demandItem.findMany({ where: { packId }, orderBy: [{ votes: 'desc' }, { createdAt: 'asc' }] });
  const mine = new Set((await prisma.demandVote.findMany({ where: { personaId, demandId: { in: items.map((i) => i.id) } }, select: { demandId: true } })).map((v) => v.demandId));
  return items.map((i) => ({ ...i, votedByMe: mine.has(i.id) }));
}

export async function voteDemand(prisma: PrismaClient, packId: string, demandId: string, personaId: string): Promise<boolean> {
  const item = await prisma.demandItem.findUnique({ where: { id: demandId } });
  if (!item || item.packId !== packId) return false;
  const existing = await prisma.demandVote.findUnique({ where: { demandId_personaId: { demandId, personaId } } });
  if (existing) return false;
  await prisma.$transaction([prisma.demandVote.create({ data: { demandId, personaId } }), prisma.demandItem.update({ where: { id: demandId }, data: { votes: { increment: 1 } } })]);
  await appendAudit(prisma, { packId, actorType: 'HUMAN', actorId: personaId, action: 'DEMAND_VOTED', subjectType: 'DEMAND', subjectId: demandId, detail: {} });
  return true;
}

export async function submitDemand(prisma: PrismaClient, pack: Pack, personaId: string, input: { kind: 'PRODUCT' | 'AGENT'; title: string; description: string }): Promise<{ id: string }> {
  const packId = pack.manifest.id;
  const count = await prisma.demandItem.count({ where: { packId } });
  const id = `DM-${pack.manifest.code}-${String(count + 101).padStart(3, '0')}`;
  await prisma.demandItem.create({ data: { id, packId, kind: input.kind, title: input.title.trim().slice(0, 120), description: input.description.trim().slice(0, 1000), votes: 1, state: 'OPEN', createdBy: personaId } });
  await prisma.demandVote.create({ data: { demandId: id, personaId } });
  await appendAudit(prisma, { packId, actorType: 'HUMAN', actorId: personaId, action: 'DEMAND_SUBMITTED', subjectType: 'DEMAND', subjectId: id, detail: { title: input.title, kind: input.kind } });
  return { id };
}
