/**
 * recordDecision() — the ONLY code path that approves (invariant I04, ADR-0008): AccessRequest → GRANTED,
 * Gate → APPROVED (advancing the stage), product → CERTIFIED at gate 11; agent publish joins in Phase 6. Agents can
 * never decide, at any autonomy level. Humans must hold a required role. Policy auto-approval is a
 * SYSTEM decision whose rationale names the policy. Every decision is audited.
 */
import type { PrismaClient } from '@prisma/client';
import { appendAudit, type Db } from '@/lib/db/audit';
import type { Pack, Role } from '@/lib/packs/schema';
import { type GateVote, evaluateGateOutcome } from './gates';
import { stageDef, statusForStage } from './stages';

export type DecisionActor = { kind: 'HUMAN'; personaId: string } | { kind: 'SYSTEM'; policyId: string } | { kind: 'AGENT'; agentId: string };
export type DecisionOutcome = 'APPROVE' | 'REJECT';

export interface DecisionInput {
  subjectType: 'ACCESS_REQUEST' | 'GATE' | 'TRIAGE' | 'AGENT_PUBLISH';
  subjectId: string;
  actor: DecisionActor;
  outcome: DecisionOutcome | 'VETO';
  rationale: string;
  /** AGENT_PUBLISH: the release step being approved. */
  release?: 'pilot' | 'canary' | 'production';
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
  if (input.subjectType === 'TRIAGE') return decideTriage(prisma, pack, input);
  if (input.subjectType === 'AGENT_PUBLISH') return decideAgentPublish(prisma, pack, input);
  return input.subjectType === 'GATE' ? decideGate(prisma, pack, input) : decideAccess(prisma, pack, input);
}

async function decideAccess(prisma: Db, pack: Pack, input: DecisionInput): Promise<DecisionResult> {
  if (input.outcome === 'VETO') throw new DecisionRefused('Access requests are approved or rejected.');
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
    if (input.actor.kind !== 'HUMAN') throw new DecisionRefused('Agents act, humans decide.');
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

/** Next semantic version on certification: a release candidate drops its suffix; 0.x becomes 1.0.0. */
export function publishVersion(current: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(current);
  if (!m) return '1.0.0';
  const [, major = '0', minor = '0', patch = '0', pre] = m;
  if (pre) return `${major}.${minor}.${patch}`;
  return Number(major) < 1 ? '1.0.0' : `${major}.${Number(minor) + 1}.0`;
}

async function decideGate(prisma: Db, pack: Pack, input: DecisionInput): Promise<DecisionResult> {
  const packId = pack.manifest.id;
  if (input.actor.kind !== 'HUMAN') throw new DecisionRefused('Gates are decided by people holding the gate roles.');
  const gate = await prisma.gate.findUnique({ where: { id: input.subjectId } });
  if (!gate) throw new DecisionRefused('Unknown gate.');
  const product = await prisma.dataProduct.findUnique({ where: { id: gate.productId } });
  if (!product || product.packId !== packId) throw new DecisionRefused('Unknown gate.');
  if (gate.state !== 'IN_REVIEW') throw new DecisionRefused(`Gate ${gate.stage} is ${gate.state.toLowerCase().replace('_', ' ')}, not in review.`);
  const def = stageDef(gate.stage).gate;
  if (!def) throw new DecisionRefused('This stage has no gate.');
  const personaId = input.actor.personaId;
  const persona = pack.personas.find((p) => p.id === personaId);
  if (!persona) throw new DecisionRefused('Unknown persona.');
  const roles = def.roles.filter((r) => persona.roles.includes(r));
  if (!roles.length) throw new DecisionRefused(`Gate ${gate.stage} needs one of: ${def.roles.join(', ')}.`);
  if (input.outcome === 'VETO' && !persona.roles.some((r) => def.veto.includes(r))) throw new DecisionRefused('Only a veto role can veto this gate.');

  const decisionIds: string[] = [];
  for (const role of roles) {
    const d = await prisma.decision.create({ data: { packId, subjectType: 'GATE', subjectId: gate.id, gateId: gate.id, personaId, role, outcome: input.outcome, rationale: input.rationale } });
    decisionIds.push(d.id);
  }
  const since = gate.submittedAt ?? new Date(0);
  const decisions = await prisma.decision.findMany({ where: { subjectType: 'GATE', subjectId: gate.id, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } });
  const votes: GateVote[] = decisions.map((d) => ({ personaId: d.personaId, personaRoles: pack.personas.find((p) => p.id === d.personaId)?.roles ?? [], outcome: d.outcome as GateVote['outcome'] }));
  const outcome = evaluateGateOutcome(def, votes);

  if (outcome.state !== 'IN_REVIEW') {
    await prisma.gate.update({ where: { id: gate.id }, data: { state: outcome.state, staleReason: null } });
    const run = await prisma.stageRun.findFirst({ where: { productId: gate.productId, stage: gate.stage }, orderBy: { attempt: 'desc' } });
    if (outcome.state === 'REJECTED') {
      if (run && run.state === 'IN_REVIEW') await prisma.stageRun.update({ where: { id: run.id }, data: { state: 'IN_PROGRESS' } });
    } else if (product.currentStage === gate.stage) {
      if (run) await prisma.stageRun.update({ where: { id: run.id }, data: { state: 'COMPLETE', completedAt: new Date() } });
      const next = Math.min(12, gate.stage + 1);
      const certify = gate.stage === 11;
      await prisma.dataProduct.update({
        where: { id: product.id },
        data: { currentStage: next, status: statusForStage(next), ...(certify ? { semanticVersion: publishVersion(product.semanticVersion), publishedAt: new Date() } : {}) },
      });
      if (!(await prisma.stageRun.findFirst({ where: { productId: product.id, stage: next } }))) await prisma.stageRun.create({ data: { productId: product.id, stage: next, state: 'IN_PROGRESS', startedAt: new Date() } });
      const nextGate = stageDef(next).gate;
      if (nextGate && next !== gate.stage && !(await prisma.gate.findUnique({ where: { productId_stage: { productId: product.id, stage: next } } }))) {
        await prisma.gate.create({ data: { productId: product.id, stage: next, state: 'PENDING', quorum: nextGate.quorum, requiredRolesJson: JSON.stringify(nextGate.roles), vetoRolesJson: JSON.stringify(nextGate.veto) } });
      }
    } else {
      // Re-approval of a STALE gate: close the open re-approval tasks.
      await prisma.task.updateMany({ where: { productId: product.id, kind: 'REAPPROVE', state: 'OPEN', title: { startsWith: `Re-approve gate ${gate.stage} ` } }, data: { state: 'DONE' } });
    }
  }
  await appendAudit(prisma, {
    packId,
    actorType: 'HUMAN',
    actorId: personaId,
    action: `GATE_${input.outcome}`,
    subjectType: 'GATE',
    subjectId: gate.id,
    detail: { productId: gate.productId, stage: gate.stage, roles, state: outcome.state, approvals: outcome.approvals, missingRoles: outcome.missingRoles, rationale: input.rationale },
  });
  return { decisionIds, state: outcome.state };
}

/** Roles that may triage intake requests (06 §7: Persona C/D). */
export const TRIAGE_ROLES: Role[] = ['DOMAIN_PRODUCT_OWNER', 'DATA_STEWARD'];

/**
 * Triage approval/decline of a ProductRequest. Approval creates the Draft product at Stage 1 (the caller
 * commits its decision register); the product id and record are created here so nothing else can.
 */
async function decideTriage(prisma: Db, pack: Pack, input: DecisionInput): Promise<DecisionResult> {
  const packId = pack.manifest.id;
  if (input.actor.kind !== 'HUMAN') throw new DecisionRefused('Triage is decided by a product owner or steward.');
  const personaId = input.actor.personaId;
  const persona = pack.personas.find((p) => p.id === personaId);
  const role = TRIAGE_ROLES.find((r) => persona?.roles.includes(r));
  if (!persona || !role) throw new DecisionRefused(`Triage needs one of: ${TRIAGE_ROLES.join(', ')}.`);
  const req = await prisma.productRequest.findUnique({ where: { id: input.subjectId } });
  if (!req || req.packId !== packId) throw new DecisionRefused('Unknown request.');
  if (!['SUBMITTED', 'TRIAGE'].includes(req.state)) throw new DecisionRefused(`This request is already ${req.state.toLowerCase()}.`);
  if (input.outcome === 'VETO') throw new DecisionRefused('Triage approves or declines.');
  const d = await prisma.decision.create({ data: { packId, subjectType: 'TRIAGE', subjectId: req.id, personaId, role, outcome: input.outcome, rationale: input.rationale } });
  let state = 'DECLINED';
  if (input.outcome === 'APPROVE') {
    const n = await prisma.dataProduct.count({ where: { packId, fromPack: false } });
    const id = `DP-${pack.manifest.code}-${String(101 + n).padStart(3, '0')}`;
    const decision = JSON.parse(req.decisionJson) as { decision: string; decider: string; cadence: string; workaround: string };
    const owner = persona.roles.includes('DOMAIN_PRODUCT_OWNER') ? persona.id : (pack.personas.find((p) => p.roles.includes('DOMAIN_PRODUCT_OWNER'))?.id ?? persona.id);
    await prisma.dataProduct.create({
      data: {
        id,
        packId,
        name: req.title,
        domain: 'Intake',
        archetype: 'CONSUMER_ALIGNED',
        tier: 'unrated',
        status: 'DRAFT',
        currentStage: 1,
        semanticVersion: '0.1.0',
        ownerPersonaId: owner,
        stewardPersonaId: pack.personas.find((p) => p.roles.includes('DATA_STEWARD'))?.id ?? null,
        description: decision.decision,
        purpose: `Support the decision: ${decision.decision}`,
        decisionJson: JSON.stringify({ persona: decision.decider, decision: decision.decision, cadence: decision.cadence, workaround: decision.workaround, consequence: req.stakes }),
        sampleQuestionsJson: req.questionsJson,
        semanticView: null,
        outputPortsJson: JSON.stringify([{ kind: 'sql', ref: `DATA_PRODUCTS.${id.replace(/-/g, '_')}` }]),
        slaJson: JSON.stringify({ freshness_minutes: 1440, availability_pct: 99, max_null_rate_pct: 1 }),
        sensitivityJson: '[]',
        kpiIdsJson: '[]',
        upstreamJson: '[]',
        fromPack: false,
      },
    });
    await prisma.stageRun.create({ data: { productId: id, stage: 1, state: 'IN_PROGRESS', startedAt: new Date() } });
    const g = stageDef(1).gate;
    if (g) await prisma.gate.create({ data: { productId: id, stage: 1, state: 'PENDING', quorum: g.quorum, requiredRolesJson: JSON.stringify(g.roles), vetoRolesJson: JSON.stringify(g.veto) } });
    await prisma.productRequest.update({ where: { id: req.id }, data: { state: 'APPROVED', createdProductId: id } });
    state = 'APPROVED';
  } else {
    await prisma.productRequest.update({ where: { id: req.id }, data: { state: 'DECLINED', declineReason: input.rationale } });
  }
  await appendAudit(prisma, { packId, actorType: 'HUMAN', actorId: personaId, action: `TRIAGE_${input.outcome}`, subjectType: 'PRODUCT_REQUEST', subjectId: req.id, detail: { reference: req.reference, state, rationale: input.rationale } });
  return { decisionIds: [d.id], state };
}

/** Roles that may approve an agent release (product owner or steward). */
export const PUBLISH_ROLES: Role[] = ['DOMAIN_PRODUCT_OWNER', 'DATA_STEWARD'];
const RELEASE: Record<'pilot' | 'canary' | 'production', { status: string; state: string; pct: number; from: string[] }> = {
  pilot: { status: 'PILOT', state: 'candidate', pct: 0, from: ['DRAFT'] },
  canary: { status: 'CANARY', state: 'canary', pct: 20, from: ['PILOT'] },
  production: { status: 'PRODUCTION', state: 'live', pct: 100, from: ['CANARY'] },
};

/**
 * Agent publish/release (08 §6): a human with a publish role approves each release step. Pilot needs the
 * latest publish-gate run to pass checks 1–7 (check 8 is this approval). Agents can never approve.
 */
async function decideAgentPublish(prisma: Db, pack: Pack, input: DecisionInput): Promise<DecisionResult> {
  const packId = pack.manifest.id;
  if (input.actor.kind !== 'HUMAN') throw new DecisionRefused('A person approves agent releases.');
  const personaId = input.actor.personaId;
  const persona = pack.personas.find((p) => p.id === personaId);
  const role = PUBLISH_ROLES.find((r) => persona?.roles.includes(r));
  if (!persona || !role) throw new DecisionRefused(`Releasing an agent needs one of: ${PUBLISH_ROLES.join(', ')}.`);
  const agent = await prisma.agent.findUnique({ where: { id: input.subjectId } });
  if (!agent || agent.packId !== packId) throw new DecisionRefused('Unknown agent.');
  const step = RELEASE[input.release ?? 'pilot'];
  if (!step.from.includes(agent.status)) throw new DecisionRefused(`The agent is ${agent.status.toLowerCase()}; this release step needs ${step.from.join(' or ').toLowerCase()}.`);
  if (input.outcome !== 'APPROVE') {
    const d = await prisma.decision.create({ data: { packId, subjectType: 'AGENT_PUBLISH', subjectId: agent.id, personaId, role, outcome: 'REJECT', rationale: input.rationale } });
    return { decisionIds: [d.id], state: agent.status };
  }
  const gate = await prisma.publishGateRun.findFirst({ where: { agentId: agent.id, agentVersion: agent.currentVersion }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const results = gate ? (JSON.parse(gate.resultsJson) as { id: string; passed: boolean }[]) : [];
  const blocking = results.filter((r) => r.id !== 'approval' && !r.passed);
  if (!gate || blocking.length) throw new DecisionRefused(gate ? `The publish gate is failing: ${blocking.map((b) => b.id).join(', ')}.` : 'Run the publish gate first.');
  const d = await prisma.decision.create({ data: { packId, subjectType: 'AGENT_PUBLISH', subjectId: agent.id, personaId, role, outcome: 'APPROVE', rationale: input.rationale } });
  await prisma.agent.update({ where: { id: agent.id }, data: { status: step.status } });
  const v = await prisma.agentVersion.findUnique({ where: { agentId_version: { agentId: agent.id, version: agent.currentVersion } } });
  if (v) await prisma.agentVersion.update({ where: { id: v.id }, data: { releaseState: step.state, canaryPct: step.pct } });
  await appendAudit(prisma, { packId, actorType: 'HUMAN', actorId: personaId, action: `AGENT_RELEASE_${step.status}`, subjectType: 'AGENT', subjectId: agent.id, detail: { version: agent.currentVersion, rationale: input.rationale } });
  return { decisionIds: [d.id], state: step.status };
}
