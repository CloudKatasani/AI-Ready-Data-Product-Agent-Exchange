/**
 * Access workflow (06 §6): policy preview → AccessRequest → auto-approval (a SYSTEM decision naming the
 * policy) or the approver inbox → recordDecision() → Entitlement. Nothing here grants directly.
 */
import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import { type AccessPolicyPreviewCore, recordDecision } from '@/lib/lifecycle/decisions';
import type { Pack, Role, Rubrics } from '@/lib/packs/schema';
import { rowFilterFor } from '@/lib/query/policies';
import type { Principal } from '@/lib/query/types';
import { type LiveProduct, autoApprovable, liveFromPack, maskedForPersona, productSensitivity } from './catalog';
import { productObjects } from '@/lib/lifecycle/quality';

export const AUTO_APPROVE_POLICY = 'POLICY_AUTO_APPROVE_INTERNAL';

export interface PolicyPreview extends AccessPolicyPreviewCore {
  productId: string;
  purpose: string;
  sensitivity: string[];
  maskedColumns: string[];
  rowFilter: { policyId: string; detail: string } | null;
  approvers: { personaId: string; name: string; roles: Role[] }[];
  policies: { id: string; text: string }[];
  reasons: string[];
}

export function evaluateAccess(pack: Pack, rubrics: Rubrics, productId: string, who: Principal, purpose: string, live?: LiveProduct): PolicyPreview {
  const product = pack.products.find((p) => p.id === productId);
  if (!product) throw new Error(`Unknown product ${productId}`);
  const l = live ?? liveFromPack(product);
  const sensitivity = productSensitivity(pack, product);
  const auto = rubrics.access.purposes.includes(purpose) && autoApprovable(pack, rubrics, product, l, purpose);
  const requiredApproverRoles: Role[] = auto ? [] : sensitivity.length ? rubrics.access.sensitive_approver_roles : rubrics.access.approver_roles;
  const objects = productObjects(pack, product);
  const rf = objects.map((o) => rowFilterFor(pack, who, o)).find((x) => x !== null) ?? null;
  const maskedColumns = maskedForPersona(pack, product, who);
  const maskPolicies = [...new Set(pack.policies.column_tags.filter((t) => maskedColumns.includes(t.column) && t.masking).map((t) => t.masking as string))];
  const reasons: string[] = [];
  if (auto) reasons.push(`Certified, no sensitive columns and "${purpose}" is an internal purpose — approved automatically by ${AUTO_APPROVE_POLICY}.`);
  else {
    if (l.status !== 'CERTIFIED') reasons.push(`${product.name} is ${l.status.replace(/_/g, ' ').toLowerCase()}, so a steward reviews every request.`);
    if (sensitivity.length) reasons.push(`It touches ${sensitivity.join(', ')} data, so a privacy officer also approves.`);
    if (!rubrics.access.auto_approve_purposes.includes(purpose)) reasons.push(`"${purpose}" is not an auto-approvable purpose.`);
  }
  return {
    productId,
    purpose,
    autoApprove: auto,
    ...(auto ? { autoApprovePolicy: AUTO_APPROVE_POLICY } : {}),
    requiredApproverRoles,
    sensitivity,
    maskedColumns,
    rowFilter: rf ? { policyId: rf.policyId, detail: rf.detail } : null,
    approvers: pack.personas.filter((p) => p.id !== who.personaId && requiredApproverRoles.some((r) => p.roles.includes(r))).map((p) => ({ personaId: p.id, name: p.name, roles: p.roles.filter((r) => requiredApproverRoles.includes(r)) })),
    policies: [
      ...maskPolicies.map((id) => ({ id, text: pack.policies.masking_policies.find((m) => m.id === id)?.description ?? id })),
      ...(rf ? [{ id: rf.policyId, text: pack.policies.row_access_policies.find((r) => r.id === rf.policyId)?.description ?? rf.policyId }] : []),
    ],
    reasons,
  };
}

export interface SubmitInput {
  productId: string;
  purpose: string;
  justification: string;
  durationDays: number;
}

export class AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessError';
  }
}

export async function submitAccessRequest(prisma: PrismaClient, pack: Pack, rubrics: Rubrics, who: Principal, input: SubmitInput, live?: LiveProduct): Promise<{ id: string; state: string }> {
  if (!rubrics.access.purposes.includes(input.purpose)) throw new AccessError('Choose a purpose from the list.');
  if (!rubrics.access.durations_days.includes(input.durationDays)) throw new AccessError('Choose a duration from the list.');
  if (input.justification.trim().length < 10) throw new AccessError('Add a short justification (at least 10 characters).');
  if (who.entitlements.includes(input.productId)) throw new AccessError('You already have access to this product.');
  const open = await prisma.accessRequest.findFirst({ where: { packId: pack.manifest.id, productId: input.productId, requesterId: who.personaId, state: 'PENDING' } });
  if (open) throw new AccessError('You already have a pending request for this product.');
  const preview = evaluateAccess(pack, rubrics, input.productId, who, input.purpose, live);
  const req = await prisma.accessRequest.create({
    data: { packId: pack.manifest.id, productId: input.productId, requesterId: who.personaId, purpose: input.purpose, justification: input.justification.trim().slice(0, 1000), durationDays: input.durationDays, policyPreviewJson: JSON.stringify(preview), state: 'PENDING' },
  });
  await appendAudit(prisma, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: who.personaId, action: 'ACCESS_REQUESTED', subjectType: 'ACCESS_REQUEST', subjectId: req.id, detail: { product: input.productId, purpose: input.purpose, durationDays: input.durationDays, autoApprove: preview.autoApprove } });
  if (preview.autoApprove) {
    const r = await recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'SYSTEM', policyId: AUTO_APPROVE_POLICY }, outcome: 'APPROVE', rationale: preview.reasons.join(' ') });
    return { id: req.id, state: r.state };
  }
  return { id: req.id, state: 'PENDING' };
}

export interface InboxItem {
  id: string;
  productId: string | null;
  productName: string;
  requester: string;
  requesterId: string;
  purpose: string;
  justification: string;
  durationDays: number;
  preview: PolicyPreview;
  createdAt: Date;
  myRoles: Role[];
}

/** Pending requests the persona can decide (holds a required role and is not the requester). */
export async function approverInbox(prisma: PrismaClient, pack: Pack, personaId: string): Promise<InboxItem[]> {
  const persona = pack.personas.find((p) => p.id === personaId);
  if (!persona) return [];
  const rows = await prisma.accessRequest.findMany({ where: { packId: pack.manifest.id, state: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  const out: InboxItem[] = [];
  for (const r of rows) {
    const preview = JSON.parse(r.policyPreviewJson) as PolicyPreview;
    const myRoles = preview.requiredApproverRoles.filter((x) => persona.roles.includes(x));
    if (!myRoles.length || r.requesterId === personaId) continue;
    out.push({
      id: r.id,
      productId: r.productId,
      productName: pack.products.find((p) => p.id === r.productId)?.name ?? r.productId ?? '',
      requester: pack.personas.find((p) => p.id === r.requesterId)?.name ?? r.requesterId,
      requesterId: r.requesterId,
      purpose: r.purpose,
      justification: r.justification,
      durationDays: r.durationDays,
      preview,
      createdAt: r.createdAt,
      myRoles,
    });
  }
  return out;
}

export async function myRequests(prisma: PrismaClient, packId: string, personaId: string) {
  return prisma.accessRequest.findMany({ where: { packId, requesterId: personaId }, orderBy: { createdAt: 'desc' }, take: 20 });
}
