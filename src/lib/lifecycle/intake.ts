/**
 * Intake & triage (06 §7, ported ADPM flow): a five-step wizard creates a ProductRequest with duplicate
 * candidates (AC5.1); triage approves (recordDecision → Draft product at Stage 1 with its decision
 * register committed), merges into an existing product, or declines with a reason. SLA from the rubric.
 */
import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import { duplicateCandidates, type DuplicateCandidate } from '@/lib/packs/similarity';
import type { Pack, Rubrics } from '@/lib/packs/schema';
import { recordDecision } from './decisions';
import { commitArtifact } from './engine';

export interface IntakeInput {
  title: string;
  decision: string;
  decider: string;
  cadence: string;
  workaround: string;
  questions: string[];
  stakes: string;
  freshness: string;
}

export class IntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntakeError';
  }
}

export function validateIntake(i: IntakeInput): string[] {
  const errors: string[] = [];
  if (i.title.trim().length < 4) errors.push('Give the request a short title.');
  if (i.decision.trim().length < 10) errors.push('Describe the decision you are blocked on.');
  if (!i.decider.trim()) errors.push('Who makes the decision?');
  if (i.questions.filter((q) => q.trim()).length < 3) errors.push('Add at least three questions you would ask.');
  if (!i.stakes.trim()) errors.push('What happens if the decision is wrong?');
  return errors;
}

/** Duplicate candidates for an intake (product/agent/scenario similarity ≥ rubric threshold surfaced first). */
export function intakeDuplicates(pack: Pack, rubrics: Rubrics, i: Pick<IntakeInput, 'title' | 'decision' | 'questions'>): DuplicateCandidate[] {
  return duplicateCandidates(pack, rubrics, [i.title, i.decision, ...i.questions].join(' '), [], i.questions).filter((d) => d.kind !== 'demand');
}

export async function submitIntake(client: PrismaClient, pack: Pack, rubrics: Rubrics, requesterId: string, i: IntakeInput): Promise<{ id: string; reference: string; duplicates: DuplicateCandidate[] }> {
  const errors = validateIntake(i);
  if (errors.length) throw new IntakeError(errors.join(' '));
  const n = await client.productRequest.count({ where: { packId: pack.manifest.id } });
  const reference = `REQ-${pack.manifest.code}-${String(n + 1).padStart(3, '0')}`;
  const duplicates = intakeDuplicates(pack, rubrics, i);
  const r = await client.productRequest.create({
    data: {
      reference,
      packId: pack.manifest.id,
      title: i.title.trim(),
      requesterId,
      state: 'SUBMITTED',
      decisionJson: JSON.stringify({ decision: i.decision.trim(), decider: i.decider.trim(), cadence: i.cadence.trim(), workaround: i.workaround.trim() }),
      questionsJson: JSON.stringify(i.questions.map((q) => q.trim()).filter(Boolean)),
      stakes: i.stakes.trim(),
      freshness: i.freshness.trim(),
      duplicateCandidatesJson: JSON.stringify(duplicates),
      slaDueAt: new Date(Date.parse(`${pack.manifest.asOf}T09:00:00Z`) + rubrics.intake.triage_sla_hours * 3_600_000),
    },
  });
  await appendAudit(client, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: requesterId, action: 'INTAKE_SUBMITTED', subjectType: 'PRODUCT_REQUEST', subjectId: r.id, detail: { reference, duplicates: duplicates.map((d) => `${d.id}:${d.similarity}`) } });
  return { id: r.id, reference, duplicates };
}

export async function triageApprove(client: PrismaClient, pack: Pack, requestId: string, personaId: string, rationale: string): Promise<{ productId: string }> {
  await recordDecision(client, pack, { subjectType: 'TRIAGE', subjectId: requestId, actor: { kind: 'HUMAN', personaId }, outcome: 'APPROVE', rationale });
  const req = await client.productRequest.findUnique({ where: { id: requestId } });
  if (!req?.createdProductId) throw new IntakeError('Triage approval did not create a product.');
  const d = JSON.parse(req.decisionJson) as { decision: string; decider: string; cadence: string; workaround: string };
  await commitArtifact(client, pack, {
    productId: req.createdProductId,
    type: 'decision-register',
    content: { decision: d.decision, decider: d.decider, cadence: d.cadence, workaround: d.workaround, consequence: req.stakes, questions: JSON.parse(req.questionsJson) as string[], intakeReference: req.reference },
    committedBy: req.requesterId,
    message: `Decision register from intake ${req.reference}`,
  });
  return { productId: req.createdProductId };
}

export async function triageDecline(client: PrismaClient, pack: Pack, requestId: string, personaId: string, reason: string): Promise<void> {
  if (reason.trim().length < 5) throw new IntakeError('A decline needs a reason.');
  await recordDecision(client, pack, { subjectType: 'TRIAGE', subjectId: requestId, actor: { kind: 'HUMAN', personaId }, outcome: 'REJECT', rationale: reason });
}

/** Merge into an existing product: links the request and notifies the requester (audit). Not an approval. */
export async function triageMerge(client: PrismaClient, pack: Pack, requestId: string, personaId: string, productId: string): Promise<void> {
  const req = await client.productRequest.findUnique({ where: { id: requestId } });
  if (!req || req.packId !== pack.manifest.id || !['SUBMITTED', 'TRIAGE'].includes(req.state)) throw new IntakeError('This request cannot be merged.');
  if (!pack.products.some((p) => p.id === productId)) throw new IntakeError('Unknown product.');
  const persona = pack.personas.find((p) => p.id === personaId);
  if (!persona?.roles.some((r) => r === 'DOMAIN_PRODUCT_OWNER' || r === 'DATA_STEWARD')) throw new IntakeError('Only a product owner or steward can triage.');
  await client.productRequest.update({ where: { id: requestId }, data: { state: 'MERGED', mergedIntoId: productId } });
  await appendAudit(client, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: personaId, action: 'TRIAGE_MERGED', subjectType: 'PRODUCT_REQUEST', subjectId: requestId, detail: { into: productId, notify: req.requesterId } });
}
