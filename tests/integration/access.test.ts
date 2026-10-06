import { describe, expect, it } from 'vitest';
import { respondScripted } from '@/lib/agents/scripted/respond';
import { db } from '@/lib/db';
import { DecisionRefused, recordDecision } from '@/lib/lifecycle/decisions';
import { approverInbox, evaluateAccess, submitAccessRequest } from '@/lib/marketplace/access';
import { productBadge, liveFromPack } from '@/lib/marketplace/catalog';
import { principalForPersona } from '@/lib/presenter/governed';
import { principalFor } from '@/lib/query/principal';
import { pack, persona, rubrics, service } from '../setup/query';

const A = () => pack.personas.find((p) => p.archetype === 'A')?.id ?? '';
const D = () => pack.personas.find((p) => p.archetype === 'D')?.id ?? '';
const product = (id: string) => {
  const p = pack.products.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('AC3.1 — Restricted → request → approve as D → Granted, and the agent can answer', () => {
  it('runs the whole flow through recordDecision()', async () => {
    const prisma = db();
    const target = product('DP-UTL-004');
    const before = await principalForPersona(pack.manifest.id, A());
    expect(productBadge(pack, rubrics, target, liveFromPack(target), before, new Set())).toBe('Restricted');

    const scenario = pack.scenarios.find((s) => s.agent === 'AG-UTL-004' && s.kind === 'answer');
    if (!scenario) throw new Error('no AG-UTL-004 answer scenario');
    const { qs } = await service();
    const declined = await respondScripted('AG-UTL-004', scenario.question, { pack, rubrics, qs, who: before });
    expect(declined.kind).toBe('decline');
    expect(declined.requestProductId).toBe('DP-UTL-004');

    const req = await submitAccessRequest(prisma, pack, rubrics, before, { productId: 'DP-UTL-004', purpose: 'Analytics & insight', justification: 'Asset health for my regional crew planning', durationDays: 90 });
    expect(req.state).toBe('PENDING');
    const pending = await principalForPersona(pack.manifest.id, A());
    expect(pending.entitlements).not.toContain('DP-UTL-004');

    const inbox = await approverInbox(prisma, pack, D());
    expect(inbox.map((i) => i.id)).toContain(req.id);
    expect(await approverInbox(prisma, pack, A())).toHaveLength(0);

    const decision = await recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'HUMAN', personaId: D() }, outcome: 'APPROVE', rationale: 'Regional planning need' });
    expect(decision.state).toBe('GRANTED');

    const after = await principalForPersona(pack.manifest.id, A());
    expect(after.entitlements).toContain('DP-UTL-004');
    expect(productBadge(pack, rubrics, target, liveFromPack(target), after, new Set())).toBe('Granted');
    const answered = await respondScripted('AG-UTL-004', scenario.question, { pack, rubrics, qs, who: after });
    expect(answered.kind).toBe('answer');

    const ent = await prisma.entitlement.findFirst({ where: { personaId: A(), subjectId: 'DP-UTL-004', grantedVia: 'REQUEST' } });
    expect(ent?.expiresAt?.toISOString().slice(0, 10)).toBe(new Date(Date.parse(`${pack.manifest.asOf}T00:00:00Z`) + 90 * 86_400_000).toISOString().slice(0, 10));
    const audit = await prisma.auditEvent.findMany({ where: { subjectId: req.id } });
    expect(audit.map((a) => a.action).sort()).toEqual(['ACCESS_APPROVE', 'ACCESS_REQUESTED']);
  });
});

describe('access policy preview and decision rules', () => {
  it('previews required approvers, masked columns and the row filter for persona A', () => {
    const p = evaluateAccess(pack, rubrics, 'DP-UTL-001', persona('A'), 'Analytics & insight');
    expect(p.autoApprove).toBe(false);
    expect(p.requiredApproverRoles).toEqual(rubrics.access.sensitive_approver_roles);
    expect(p.maskedColumns.length).toBeGreaterThan(0);
    expect(p.rowFilter?.policyId).toBe('RAP_REGION');
    expect(p.approvers.map((a) => a.personaId)).toContain(D());
  });

  it('auto-approves a certified, non-sensitive product for an internal purpose (SYSTEM decision, audited)', async () => {
    const prisma = db();
    const who = principalFor(pack, pack.personas.find((p) => p.archetype === 'B')?.id ?? '', []);
    const r = await submitAccessRequest(prisma, pack, rubrics, who, { productId: 'DP-UTL-003', purpose: 'Operational reporting', justification: 'Daily read-rate monitoring', durationDays: 30 });
    expect(r.state).toBe('GRANTED');
    const d = await prisma.decision.findFirst({ where: { subjectId: r.id } });
    expect(d?.personaId).toBe(`${pack.manifest.id}:system`);
    expect(d?.rationale).toMatch(/^POLICY_AUTO_APPROVE_INTERNAL/);
  });

  it('refuses agents, requesters deciding their own request, and personas without a required role', async () => {
    const prisma = db();
    const who = await principalForPersona(pack.manifest.id, pack.personas.find((p) => p.archetype === 'B')?.id ?? '');
    const req = await submitAccessRequest(prisma, pack, rubrics, who, { productId: 'DP-UTL-006', purpose: 'Regulatory reporting', justification: 'Supplier spend for the regulator', durationDays: 30 });
    const C = pack.personas.find((p) => p.archetype === 'C')?.id ?? '';
    await expect(recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'AGENT', agentId: 'AG-UTL-005' }, outcome: 'APPROVE', rationale: 'x' })).rejects.toThrow(DecisionRefused);
    await expect(recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'HUMAN', personaId: who.personaId }, outcome: 'APPROVE', rationale: 'mine' })).rejects.toThrow(DecisionRefused);
    await expect(recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'HUMAN', personaId: C }, outcome: 'APPROVE', rationale: 'owner' })).rejects.toThrow(/DATA_STEWARD/);
    await expect(recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'SYSTEM', policyId: 'X' }, outcome: 'APPROVE', rationale: 'auto' })).rejects.toThrow(DecisionRefused);
    const denied = await recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'HUMAN', personaId: D() }, outcome: 'REJECT', rationale: 'Use the aggregated spend KPIs instead' });
    expect(denied.state).toBe('DENIED');
    await expect(recordDecision(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'HUMAN', personaId: D() }, outcome: 'APPROVE', rationale: 'changed my mind' })).rejects.toThrow(/already denied/);
  });
});
