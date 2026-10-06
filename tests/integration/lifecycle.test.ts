import { describe, expect, it } from 'vitest';
import { respondScripted } from '@/lib/agents/scripted/respond';
import { db } from '@/lib/db';
import { acceptAll, decideProposal, runLifecycleAgent } from '@/lib/lifecycle/agent-runs';
import { DecisionRefused, recordDecision } from '@/lib/lifecycle/decisions';
import { applyFix, commitArtifact, evaluateAndStoreChecks, latestVersions, LifecycleError, submitForReview } from '@/lib/lifecycle/engine';
import { submitIntake, triageApprove } from '@/lib/lifecycle/intake';
import { recordDecision as decide } from '@/lib/lifecycle/decisions';
import { submitAccessRequest } from '@/lib/marketplace/access';
import { policyState, principalForPersona } from '@/lib/presenter/governed';
import { QueryService } from '@/lib/query/query-service';
import { MemoryLog, pack, rubrics, service, testWarehouse } from '../setup/query';

const id = (a: string) => pack.personas.find((p) => p.archetype === a)?.id ?? '';
const gateOf = async (productId: string, stage: number) => {
  const g = await db().gate.findUnique({ where: { productId_stage: { productId, stage } } });
  if (!g) throw new Error(`gate ${stage}`);
  return g;
};

describe('seeded lifecycle', () => {
  it('drove every pack product to its seed stage with real gate history', async () => {
    for (const p of pack.products) {
      const row = await db().dataProduct.findUnique({ where: { id: p.id } });
      expect(row?.status).toBe(p.initial_status);
      expect(row?.currentStage).toBe(p.seed_stage);
      const approved = await db().gate.count({ where: { productId: p.id, state: 'APPROVED' } });
      expect(approved).toBe(p.seed_stage - 1);
    }
    const seededDecisions = await db().decision.findMany({ where: { subjectType: 'GATE', packId: pack.manifest.id } });
    expect(seededDecisions.every((d) => pack.personas.some((p) => p.id === d.personaId))).toBe(true);
  });
});

describe('AC6.2 / I05 — submit is blocked while agent proposals are unreviewed', () => {
  it('blocks, then passes once a human accepts; provenance records the agent and the human', async () => {
    const { qs } = await service();
    const prisma = db();
    const pid = pack.manifest.story_roles.lifecycleDemoProduct;
    const stage = pack.products.find((p) => p.id === pid)?.seed_stage ?? 6;
    expect(await prisma.agentProposal.count({ where: { productId: pid, stage, state: 'OPEN' } })).toBeGreaterThan(0);
    const err = await submitForReview(prisma, pack, rubrics, pid, stage, id('C'), { qs }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LifecycleError);
    expect((err as LifecycleError).criteria.find((c) => c.id === 'no_unreviewed_agent_fields')?.ok).toBe(false);

    const first = await prisma.agentProposal.findFirst({ where: { productId: pid, stage, state: 'OPEN' } });
    if (!first) throw new Error('no proposal');
    const r = await decideProposal(prisma, pack, { proposalId: first.id, personaId: id('C'), outcome: 'ACCEPT' });
    const prov = await prisma.fieldProvenance.findFirst({ where: { versionId: r.versionId, fieldPath: first.fieldPath } });
    expect(prov?.source).toBe('AGENT');
    expect(prov?.agentId).toBe('semantic');
    expect(prov?.acceptedBy).toBe(id('C'));
    await acceptAll(prisma, pack, pid, stage, id('C'));
    await submitForReview(prisma, pack, rubrics, pid, stage, id('C'), { qs });
    expect((await gateOf(pid, stage)).state).toBe('IN_REVIEW');
  });

  it('agents can never decide a gate', async () => {
    const g = await gateOf(pack.manifest.story_roles.lifecycleDemoProduct, 6);
    await expect(recordDecision(db(), pack, { subjectType: 'GATE', subjectId: g.id, actor: { kind: 'AGENT', agentId: 'semantic' }, outcome: 'APPROVE', rationale: 'looks fine' })).rejects.toThrow(DecisionRefused);
  });
});

describe('AC6.3 — two certification fixes, then certify: Certified in Marketplace and a declined answer now answers', () => {
  it('runs the S2 certification moment for real', async () => {
    const prisma = db();
    const pid = pack.manifest.story_roles.certDemoProduct;
    const { qs } = await service();
    const before = await evaluateAndStoreChecks(prisma, pack, rubrics, pid, { qs });
    expect(before.filter((c) => c.status !== 'pass').map((c) => `${c.n}:${c.status}`)).toEqual(['4:warn', '6:fail']);
    await expect(submitForReview(prisma, pack, rubrics, pid, 11, id('C'), { qs })).rejects.toThrow(LifecycleError);

    const a0 = await principalForPersona(pack.manifest.id, id('A'));
    const scenario = pack.scenarios.find((s) => s.agent === 'AG-UTL-001' && s.query?.view === 'BILLING_AR' && s.personas_expect.A?.kind === 'decline');
    if (!scenario) throw new Error('scenario');
    expect((await respondScripted(scenario.agent, scenario.question, { pack, rubrics, qs, who: a0 })).kind).toBe('decline');

    for (const fix of pack.products.find((p) => p.id === pid)?.certification_script?.fixes ?? []) await applyFix(prisma, pack, rubrics, pid, fix.id, id('D'), { qs });
    const after = await evaluateAndStoreChecks(prisma, pack, rubrics, pid, { qs });
    expect(after.every((c) => c.status === 'pass')).toBe(true);
    const latest = (await latestVersions(prisma, pid)).get('certification-scorecard')?.content ?? {};
    await commitArtifact(prisma, pack, { productId: pid, type: 'certification-scorecard', content: { ...latest, checks: after.map((c) => ({ check: c.label, status: c.status, detail: c.detail })) }, committedBy: id('C'), message: 'Checks after fixes' });
    await submitForReview(prisma, pack, rubrics, pid, 11, id('C'), { qs });
    const gate = await gateOf(pid, 11);
    expect((await recordDecision(prisma, pack, { subjectType: 'GATE', subjectId: gate.id, actor: { kind: 'HUMAN', personaId: id('D') }, outcome: 'APPROVE', rationale: 'Checks pass' })).state).toBe('IN_REVIEW');
    expect((await recordDecision(prisma, pack, { subjectType: 'GATE', subjectId: gate.id, actor: { kind: 'HUMAN', personaId: id('E') }, outcome: 'APPROVE', rationale: 'Council quorum' })).state).toBe('APPROVED');
    const row = await prisma.dataProduct.findUnique({ where: { id: pid } });
    expect(row?.status).toBe('CERTIFIED');
    expect(row?.semanticVersion).toBe('1.0.0');

    // Masking attached by FIX-2 is live in the governed path, and sources now cite a certified product.
    const state = await policyState(pack.manifest.id);
    expect(state.appliedFixes).toEqual(expect.arrayContaining(['FIX-1', 'FIX-2']));
    const liveQs = new QueryService({ pack, rubrics, warehouse: await testWarehouse(), log: new MemoryLog(), state });
    const req = await submitAccessRequest(prisma, pack, rubrics, a0, { productId: pid, purpose: 'Analytics & insight', justification: 'Receivables for my region', durationDays: 90 });
    await decide(prisma, pack, { subjectType: 'ACCESS_REQUEST', subjectId: req.id, actor: { kind: 'HUMAN', personaId: id('D') }, outcome: 'APPROVE', rationale: 'Certified now' });
    const answer = await respondScripted(scenario.agent, scenario.question, { pack, rubrics, qs: liveQs, who: await principalForPersona(pack.manifest.id, id('A')) });
    expect(answer.kind).toBe('answer');
    expect(answer.result?.sources.find((s) => s.productId === pid)).toMatchObject({ certified: true, version: '1.0.0' });
    expect(answer.banners.some((b) => b.kind === 'not_certified')).toBe(false);
  });
});

describe('AC6.4 — changing a contract column after Stage 5 approval makes the Stage 5 gate STALE', () => {
  it('cascades to STALE with re-approval tasks', async () => {
    const prisma = db();
    const pid = 'DP-UTL-003';
    expect((await gateOf(pid, 5)).state).toBe('APPROVED');
    const contract = (await latestVersions(prisma, pid)).get('data-contract')?.content ?? {};
    const r = await commitArtifact(prisma, pack, { productId: pid, type: 'data-contract', content: { ...contract, columns: [...((contract.columns as string[]) ?? []), 'CONFORMED_GOLD.FCT_DAILY_USAGE.read_success_pct'] }, committedBy: id('C'), message: 'Add read success column' });
    expect(r.staleGates).toEqual([5]);
    const gate = await gateOf(pid, 5);
    expect(gate.state).toBe('STALE');
    expect(gate.staleReason).toMatch(/data-contract changed/);
    expect(await prisma.task.count({ where: { productId: pid, kind: 'REAPPROVE', state: 'OPEN' } })).toBe(2);
  });
});

describe('AC5.1 / AC5.2 — intake duplicates and triage', () => {
  it('surfaces the existing product as a duplicate and triage creates a Stage 1 product with its decision record', async () => {
    const prisma = db();
    const seeded = pack.demand.requests.find((r) => r.id === 'REQ-UTL-001');
    if (!seeded) throw new Error('REQ-UTL-001');
    const r = await submitIntake(prisma, pack, rubrics, id('A'), { title: 'Regional reliability view', decision: seeded.decision, decider: seeded.decider, cadence: seeded.cadence, workaround: seeded.workaround, questions: seeded.questions, stakes: seeded.stakes, freshness: seeded.freshness });
    const dup = r.duplicates.find((d) => d.id === 'DP-UTL-002');
    expect(dup?.similarity).toBeGreaterThanOrEqual(rubrics.intake.duplicate_similarity);

    const fresh = await submitIntake(prisma, pack, rubrics, id('A'), { title: 'Storm crew staging', decision: 'How many contractor crews to pre-stage before a forecast storm', decider: 'Director of Distribution Operations', cadence: 'Before each forecast event', workaround: 'Phone calls with contractors', questions: ['How many crews did similar storms need?', 'Where did crews wait longest?', 'Which contractors were fastest?'], stakes: 'Slow restoration', freshness: 'Hourly' });
    const { productId } = await triageApprove(prisma, pack, fresh.id, id('C'), 'Clear decision and owner');
    const product = await prisma.dataProduct.findUnique({ where: { id: productId } });
    expect(product).toMatchObject({ status: 'DRAFT', currentStage: 1, fromPack: false });
    const reg = (await latestVersions(prisma, productId)).get('decision-register');
    expect(reg?.content.decision).toBe('How many contractor crews to pre-stage before a forecast storm');
    expect((await prisma.productRequest.findUnique({ where: { id: fresh.id } }))?.createdProductId).toBe(productId);
    await expect(triageApprove(prisma, pack, fresh.id, id('A'), 'again')).rejects.toThrow();
  });

  it('a lifecycle agent proposes for a new product and nothing changes until a human accepts', async () => {
    const prisma = db();
    const p = await prisma.dataProduct.findFirst({ where: { fromPack: false } });
    if (!p) throw new Error('no studio product');
    const before = (await latestVersions(prisma, p.id)).get('decision-register')?.version;
    const run = await runLifecycleAgent(prisma, pack, rubrics, { productId: p.id, stage: 1, trigger: 'MANUAL', requestedBy: id('C') });
    expect(run.narrative).toMatch(/Discovery/);
    expect((await latestVersions(prisma, p.id)).get('decision-register')?.version).toBe(before);
  });
});
