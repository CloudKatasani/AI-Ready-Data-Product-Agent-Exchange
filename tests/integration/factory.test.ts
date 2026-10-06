import { describe, expect, it } from 'vitest';
import { designInstructions, proposeCoverage } from '@/lib/agents/factory';
import { db } from '@/lib/db';
import { approveRelease, createDraft, livePack, loadDraft, runEvaluation, runPublishGate, saveDraft } from '@/lib/presenter/factory';
import { ask } from '@/lib/presenter/ask';
import { pack } from '../setup/query';

const id = (a: string) => pack.personas.find((p) => p.archetype === a)?.id ?? '';

async function build(productIds: string[], name: string) {
  const agentId = await createDraft(pack.manifest.id, id('C'));
  const draft = await loadDraft(pack.manifest.id, agentId);
  if (!draft) throw new Error('draft');
  const coverage = proposeCoverage(pack, productIds);
  const kpiIds = coverage.map((c) => c.kpi);
  const designed = designInstructions(pack, { name, personaServed: 'Operations analysts', decisions: ['Where to focus field crews'], productIds, kpiIds });
  const a = draft.agent;
  a.manifest = { ...a.manifest, name, capability: `Answers ${kpiIds.length} governed KPIs.`, products: productIds.map((p) => ({ id: p, columns: '*' as const })), kpi_coverage: coverage, out_of_scope: designed.outOfScope };
  a.instructions = designed.instructions;
  await saveDraft(pack.manifest.id, agentId, a, id('C'));
  return agentId;
}

describe('Agent Factory', () => {
  it('AC7.1 an agent bound to a non-certified product cannot pass the publish gate', async () => {
    const agentId = await build(['DP-UTL-007'], 'Vegetation Watch');
    const checks = await runPublishGate(pack.manifest.id, agentId);
    expect(checks.find((c) => c.id === 'certified')?.passed).toBe(false);
    await expect(approveRelease(pack.manifest.id, agentId, id('C'), 'pilot', 'try')).rejects.toThrow(/publish gate is failing/);
  });

  it('AC7.2 a factory-built agent answers ≥ 80% of its generated golden set in scripted mode, passes the gate and is released by a human', async () => {
    const agentId = await build(['DP-UTL-003'], 'Meter Read Monitor');
    const report = await runEvaluation(pack.manifest.id, agentId);
    expect(report.suites.golden.n).toBeGreaterThanOrEqual(5);
    expect(report.suites.golden.score, JSON.stringify(report.cases.filter((c) => c.suite === 'golden' && !c.pass).map((c) => [c.question, c.reason]))).toBeGreaterThanOrEqual(0.8);
    expect(report.suites.adversarial.score).toBe(1);
    const checks = await runPublishGate(pack.manifest.id, agentId);
    expect(checks.filter((c) => !c.passed).map((c) => c.id), JSON.stringify([report.suites, report.cases.filter((c) => !c.pass).map((c) => [c.suite, c.question, c.actual])])).toEqual(['approval']);
    await expect(approveRelease(pack.manifest.id, agentId, id('A'), 'pilot', 'not my call')).rejects.toThrow(/needs one of/);
    expect((await approveRelease(pack.manifest.id, agentId, id('C'), 'pilot', 'Eval and gate pass')).state).toBe('PILOT');
    expect((await runPublishGate(pack.manifest.id, agentId)).every((c) => c.passed)).toBe(true);
    expect((await approveRelease(pack.manifest.id, agentId, id('D'), 'canary', 'Canary at 20%')).state).toBe('CANARY');

    const live = await livePack(pack.manifest.id);
    expect(live.agents.some((a) => a.id === agentId)).toBe(true);
    const out = await ask({ packId: pack.manifest.id, personaId: id('B'), question: 'What is the AMI read success rate by region last month?', agentId });
    expect(out.answer.kind).toBe('answer');
    expect(out.answer.agentId).toBe(agentId);
    expect(await db().decision.count({ where: { subjectType: 'AGENT_PUBLISH', subjectId: agentId, outcome: 'APPROVE' } })).toBe(2);
  });
});
