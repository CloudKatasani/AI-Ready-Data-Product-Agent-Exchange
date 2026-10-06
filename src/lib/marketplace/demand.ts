/**
 * Demand board (01 §M3): requests for products/agents that don't exist yet. Voting is one vote per
 * persona. Submitting runs a duplicate check (TF-IDF cosine) against existing products, agents and open
 * demand, using the rubric's intake similarity threshold.
 */
import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import type { Pack, Rubrics } from '@/lib/packs/schema';

const STOP = new Set('a an and are as at be by for from how in is it of on or our that the to was what which with we our per'.split(' '));
const terms = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));

function tfidf(docs: string[][]): Map<string, number>[] {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  return docs.map((d) => {
    const v = new Map<string, number>();
    for (const t of d) v.set(t, (v.get(t) ?? 0) + 1);
    for (const [t, n] of v) v.set(t, n * Math.log(1 + docs.length / (df.get(t) ?? 1)));
    return v;
  });
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [t, x] of a) dot += x * (b.get(t) ?? 0);
  const n = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, x) => s + x * x, 0));
  const d = n(a) * n(b);
  return d ? dot / d : 0;
}

export interface DuplicateCandidate {
  kind: 'product' | 'agent' | 'demand';
  id: string;
  name: string;
  similarity: number;
}

/** Existing products, agents and demand items similar to a text (similarity ≥ rubric threshold). */
export function duplicateCandidates(pack: Pack, rubrics: Rubrics, text: string, demand: { id: string; title: string; description: string }[] = []): DuplicateCandidate[] {
  const corpus: { kind: DuplicateCandidate['kind']; id: string; name: string; text: string }[] = [
    ...pack.products.map((p) => ({ kind: 'product' as const, id: p.id, name: p.name, text: `${p.name} ${p.description} ${p.purpose} ${p.decision.decision} ${p.sample_questions.join(' ')} ${pack.scenarios.filter((s) => pack.agents.find((a) => a.id === s.agent)?.products.some((b) => b.id === p.id)).map((s) => s.question).join(' ')}` })),
    ...pack.agents.map((a) => ({ kind: 'agent' as const, id: a.id, name: a.name, text: `${a.name} ${a.capability} ${pack.scenarios.filter((s) => s.agent === a.id).map((s) => s.question).join(' ')}` })),
    ...demand.map((d) => ({ kind: 'demand' as const, id: d.id, name: d.title, text: `${d.title} ${d.description}` })),
  ];
  const vecs = tfidf([terms(text), ...corpus.map((c) => terms(c.text))]);
  const q = vecs[0] ?? new Map();
  return corpus
    .map((c, i) => ({ kind: c.kind, id: c.id, name: c.name, similarity: Math.round(cosine(q, vecs[i + 1] ?? new Map()) * 100) / 100 }))
    .filter((c) => c.similarity >= rubrics.intake.duplicate_similarity * 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

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
