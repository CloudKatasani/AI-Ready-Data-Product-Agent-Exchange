/**
 * Autopilot (06 §4, ported Run Console): walks a product stage by stage — run the stage agent, pause for
 * human review of its proposals, submit for the gate when criteria pass, pause for the gate's humans,
 * continue once approved. It never accepts proposals and never decides a gate.
 */
import type { PrismaClient } from '@prisma/client';
import type { Pack, Rubrics } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';
import { runLifecycleAgent } from './agent-runs';
import { exitCriteria, criteriaMet } from './criteria';
import { gatherCriteriaFacts, LifecycleError, submitForReview } from './engine';
import { stageDef } from './stages';

export type AutopilotState = 'RUNNING' | 'AWAITING_REVIEW' | 'AWAITING_GATE' | 'COMPLETED' | 'CANCELLED';

export interface AutopilotStep {
  stage: number;
  kind: 'agent' | 'await_review' | 'submit' | 'await_gate' | 'advance' | 'blocked' | 'complete';
  text: string;
}

export async function startAutopilot(client: PrismaClient, productId: string, personaId: string, mode: 'automated' | 'manual' = 'automated'): Promise<string> {
  const running = await client.autopilotRun.findFirst({ where: { productId, state: { in: ['RUNNING', 'AWAITING_REVIEW', 'AWAITING_GATE'] } } });
  if (running) return running.id;
  const r = await client.autopilotRun.create({ data: { productId, mode, state: 'RUNNING', stepsJson: '[]', startedBy: personaId } });
  return r.id;
}

export async function cancelAutopilot(client: PrismaClient, runId: string): Promise<void> {
  await client.autopilotRun.update({ where: { id: runId }, data: { state: 'CANCELLED' } });
}

/** Advances a run by one step; returns the new state. Call again after the humans act. */
export async function stepAutopilot(client: PrismaClient, pack: Pack, rubrics: Rubrics, runId: string, qs?: QueryService): Promise<{ state: AutopilotState; step: AutopilotStep }> {
  const run = await client.autopilotRun.findUnique({ where: { id: runId } });
  if (!run) throw new LifecycleError('Unknown autopilot run');
  const steps = JSON.parse(run.stepsJson) as AutopilotStep[];
  const product = await client.dataProduct.findUnique({ where: { id: run.productId } });
  if (!product) throw new LifecycleError('Unknown product');
  const stage = product.currentStage;
  const save = async (state: AutopilotState, step: AutopilotStep) => {
    await client.autopilotRun.update({ where: { id: runId }, data: { state, stepsJson: JSON.stringify([...steps, step]) } });
    return { state, step };
  };
  if (run.state === 'CANCELLED' || run.state === 'COMPLETED') return { state: run.state as AutopilotState, step: steps.at(-1) ?? { stage, kind: 'complete', text: 'Done' } };
  const def = stageDef(stage);
  if (!def.gate) return save('COMPLETED', { stage, kind: 'complete', text: `${product.name} is in ${def.name}; the Steward agent monitors it from here.` });

  const gate = await client.gate.findUnique({ where: { productId_stage: { productId: product.id, stage } } });
  if (gate?.state === 'IN_REVIEW') return save('AWAITING_GATE', { stage, kind: 'await_gate', text: `Gate ${stage} is waiting for ${JSON.parse(gate.requiredRolesJson).join(' + ')} (quorum ${gate.quorum}). Switch persona to decide.` });

  const open = await client.agentProposal.count({ where: { productId: product.id, stage, state: 'OPEN' } });
  if (open) return save('AWAITING_REVIEW', { stage, kind: 'await_review', text: `${open} proposal(s) on stage ${stage} need a human: accept, edit or reject.` });

  const criteria = exitCriteria(stage, rubrics, await gatherCriteriaFacts(client, pack, rubrics, product.id, stage, { qs }));
  if (criteriaMet(criteria)) {
    await submitForReview(client, pack, rubrics, product.id, stage, run.startedBy, { qs });
    return save('AWAITING_GATE', { stage, kind: 'submit', text: `Stage ${stage} (${def.name}) meets its exit criteria — submitted for gate review.` });
  }
  const ranBefore = steps.some((s) => s.stage === stage && s.kind === 'agent');
  if (!ranBefore) {
    const r = await runLifecycleAgent(client, pack, rubrics, { productId: product.id, stage, trigger: 'AUTOPILOT', requestedBy: run.startedBy, qs });
    return save(r.proposals ? 'AWAITING_REVIEW' : 'RUNNING', { stage, kind: 'agent', text: r.narrative });
  }
  return save('AWAITING_REVIEW', { stage, kind: 'blocked', text: `Stage ${stage} still needs: ${criteria.filter((c) => !c.ok).map((c) => c.label).join(', ')}.` });
}
