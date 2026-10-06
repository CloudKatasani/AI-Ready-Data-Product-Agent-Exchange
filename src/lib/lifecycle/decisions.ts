/**
 * recordDecision() — the ONLY code path that approves (invariant I04, ADR-0008). It sets AccessRequest to
 * GRANTED in Phase 4; Gate APPROVED and product/agent CERTIFIED/PUBLISHED join in Phase 5/6. Agents can
 * never decide, at any autonomy level. Humans must hold a required role. Policy auto-approval is a
 * SYSTEM decision whose rationale names the policy. Every decision is audited.
 */
import type { PrismaClient } from '@prisma/client';
import { appendAudit, type Db } from '@/lib/db/audit';
import type { Pack, Role } from '@/lib/packs/schema';

export type DecisionActor = { kind: 'HUMAN'; personaId: string } | { kind: 'SYSTEM'; policyId: string } | { kind: 'AGENT'; agentId: string };
export type DecisionOutcome = 'APPROVE' | 'REJECT';

export interface DecisionInput {
  subjectType: 'ACCESS_REQUEST';
  subjectId: string;
  actor: DecisionActor;
  outcome: DecisionOutcome;
  rationale: string;
}

export class DecisionRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionRefused';
  }
}

/** Shape of AccessRequest.policyPreviewJson that the decision path depends on. */
export interface AccessPolicyPreviewCore {
  autoApprove: boolean;
  autoApprovePolicy?: string;
  requiredApproverRoles: Role[];
}

function addDays(isoDate: string, days: number): Date {
  const d = new Date(`${isoDate}T23:59:59Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export interface DecisionResult {
  decisionIds: string[];
  state: string;
}

/** Records a decision on a subject and applies its effect when the decision completes the approval (one transaction). */
export async function recordDecision(client: PrismaClient, pack: Pack, input: DecisionInput): Promise<DecisionResult> {
  return client.$transaction((tx) => decide(tx, pack, input));
}

async function decide(prisma: Db, pack: Pack, input: DecisionInput): Promise<DecisionResult> {
  if (input.actor.kind === 'AGENT') throw new DecisionRefused('Agents act, humans decide: an agent cannot approve or reject.');
  if (!input.rationale.trim()) throw new DecisionRefused('A decision needs a rationale.');
  const packId = pack.manifest.id;
  const req = await prisma.accessRequest.findUnique({ where: { id: input.subjectId } });
  if (!req || req.packId !== packId) throw new DecisionRefused('Unknown access request.');
  if (req.state !== 'PENDING') throw new DecisionRefused(`This request is already ${req.state.toLowerCase()}.`);
  const preview = JSON.parse(req.policyPreviewJson) as AccessPolicyPreviewCore;

  let roles: Role[];
  let personaId: string;
  if (input.actor.kind === 'SYSTEM') {
    if (!preview.autoApprove || input.outcome !== 'APPROVE') throw new DecisionRefused('Only policy-eligible requests are approved automatically.');
    roles = [];
    personaId = `${packId}:system`;
  } else {
    personaId = input.actor.personaId;
    const persona = pack.personas.find((p) => p.id === personaId);
    if (!persona) throw new DecisionRefused('Unknown persona.');
    if (personaId === req.requesterId) throw new DecisionRefused('Requesters cannot decide their own access request.');
    roles = preview.requiredApproverRoles.filter((r) => persona.roles.includes(r));
    if (roles.length === 0) throw new DecisionRefused(`Approving needs one of: ${preview.requiredApproverRoles.join(', ')}.`);
  }

  const decisionIds: string[] = [];
  const outcome = input.outcome;
  for (const role of roles.length ? roles : ['POLICY']) {
    const d = await prisma.decision.create({ data: { packId, subjectType: input.subjectType, subjectId: req.id, personaId, role, outcome, rationale: input.actor.kind === 'SYSTEM' ? `${input.actor.policyId}: ${input.rationale}` : input.rationale } });
    decisionIds.push(d.id);
  }

  let state = req.state;
  if (outcome === 'REJECT') state = 'DENIED';
  else {
    const approvals = await prisma.decision.findMany({ where: { subjectType: 'ACCESS_REQUEST', subjectId: req.id, outcome: 'APPROVE' }, select: { role: true } });
    const covered = new Set(approvals.map((a) => a.role));
    if (input.actor.kind === 'SYSTEM' || preview.requiredApproverRoles.every((r) => covered.has(r))) state = 'GRANTED';
  }
  if (state !== req.state) {
    await prisma.accessRequest.update({ where: { id: req.id }, data: { state } });
    if (state === 'GRANTED') {
      await prisma.entitlement.create({
        data: {
          personaId: req.requesterId,
          subjectType: req.productId ? 'PRODUCT' : 'AGENT',
          subjectId: req.productId ?? req.agentId ?? '',
          purpose: req.purpose,
          grantedVia: 'REQUEST',
          expiresAt: addDays(pack.manifest.asOf, req.durationDays),
        },
      });
    }
  }
  await appendAudit(prisma, {
    packId,
    actorType: input.actor.kind,
    actorId: personaId,
    action: `ACCESS_${outcome}`,
    subjectType: 'ACCESS_REQUEST',
    subjectId: req.id,
    detail: { product: req.productId, agent: req.agentId, requester: req.requesterId, roles, state, rationale: input.rationale },
  });
  return { decisionIds, state };
}
