'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { designInstructions, type FactoryAgent, proposeCoverage } from '@/lib/agents/factory';
import { DecisionRefused } from '@/lib/lifecycle/decisions';
import { getPack, hasPack } from '@/lib/packs/registry';
import { approveRelease, createDraft, loadDraft, rollback, runEvaluation, runPublishGate, saveDraft } from '@/lib/presenter/factory';
import { activePersona } from '../../_server/session';

export interface FactoryResult {
  ok: boolean;
  message: string;
  agent?: FactoryAgent;
}

async function persona(packId: string) {
  if (!hasPack(packId)) throw new Error('Unknown pack');
  return activePersona(getPack(packId));
}

export async function newAgent(packId: string): Promise<void> {
  const id = await createDraft(packId, (await persona(packId)).id);
  redirect(`/${packId}/factory/${id}`);
}

export async function save(packId: string, agentId: string, agent: FactoryAgent): Promise<FactoryResult> {
  await saveDraft(packId, agentId, agent, (await persona(packId)).id);
  revalidatePath(`/${packId}/factory/${agentId}`);
  return { ok: true, message: 'Saved' };
}

/** Coverage proposal + Agent Designer draft for the chosen products and KPIs (heuristic provider). */
export async function design(packId: string, agentId: string, agent: FactoryAgent, kpiIds: string[]): Promise<FactoryResult> {
  const pack = getPack(packId);
  const productIds = agent.manifest.products.map((p) => p.id);
  const coverage = proposeCoverage(pack, productIds, kpiIds.length ? kpiIds : undefined);
  const d = designInstructions(pack, { name: agent.manifest.name, personaServed: agent.manifest.personas_served[0] ?? 'Business user', decisions: [agent.manifest.capability], productIds, kpiIds: coverage.map((c) => c.kpi) });
  const next: FactoryAgent = { manifest: { ...agent.manifest, kpi_coverage: coverage, out_of_scope: agent.manifest.out_of_scope.length >= 3 ? agent.manifest.out_of_scope : d.outOfScope }, instructions: d.instructions };
  await saveDraft(packId, agentId, next, (await persona(packId)).id);
  revalidatePath(`/${packId}/factory/${agentId}`);
  return { ok: true, message: `Drafted coverage for ${coverage.length} KPI(s) and four instructions — review and edit.`, agent: next };
}

export async function evaluate(packId: string, agentId: string): Promise<FactoryResult> {
  const r = await runEvaluation(packId, agentId);
  revalidatePath(`/${packId}/factory/${agentId}`);
  return { ok: r.passed, message: `Overall ${Math.round(r.overall * 100)}% — ${r.passed ? 'all thresholds met' : 'some thresholds not met'}.` };
}

export async function gate(packId: string, agentId: string): Promise<FactoryResult> {
  const checks = await runPublishGate(packId, agentId);
  revalidatePath(`/${packId}/factory/${agentId}`);
  const failing = checks.filter((c) => !c.passed);
  return { ok: failing.length === 0, message: failing.length ? `Blocking: ${failing.map((c) => c.label).join('; ')}` : 'All eight checks pass.' };
}

export async function release(packId: string, agentId: string, step: 'pilot' | 'canary' | 'production' | 'rollback', rationale: string): Promise<FactoryResult> {
  const p = await persona(packId);
  try {
    if (step === 'rollback') await rollback(packId, agentId, p.id);
    else {
      if (step === 'pilot') await runPublishGate(packId, agentId);
      const r = await approveRelease(packId, agentId, p.id, step, rationale);
      if (step === 'pilot') await runPublishGate(packId, agentId);
      revalidatePath(`/${packId}`, 'layout');
      return { ok: true, message: `Released: ${r.state.toLowerCase()}.` };
    }
    revalidatePath(`/${packId}`, 'layout');
    return { ok: true, message: 'Rolled back to Pilot.' };
  } catch (e) {
    if (e instanceof DecisionRefused) return { ok: false, message: e.message };
    throw e;
  }
}

export async function reload(packId: string, agentId: string): Promise<FactoryAgent | null> {
  return (await loadDraft(packId, agentId))?.agent ?? null;
}
