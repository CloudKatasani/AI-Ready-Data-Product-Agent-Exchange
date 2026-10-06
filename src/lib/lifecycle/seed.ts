/**
 * Lifecycle-driven seeding (03 intro, 11 Phase 5): every pack product is driven through the real engine to
 * its `seed_stage`. Blueprint artifacts are committed by the owner, exit criteria are checked for real
 * (profiling, semantic compile, DQ, certification), and gates are approved via recordDecision() by
 * seeded human personas holding the gate roles. Status and version are outcomes of the engine.
 */
import type { PrismaClient } from '@prisma/client';
import type { DataProduct, Pack, Rubrics } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';
import { runLifecycleAgent, stageEvidence } from './agent-runs';
import { blueprint } from './artifacts/blueprint';
import { recordDecision } from './decisions';
import { commitArtifact, ensureStage, evaluateAndStoreChecks, LifecycleError, submitForReview } from './engine';
import { stageDef, statusForStage } from './stages';

/** Pre-release version a pack product carries until gate 11 publishes it. */
export function seedVersion(p: DataProduct): string {
  if (p.version.includes('-') || p.seed_stage < 12) return p.version;
  return `${p.version}-rc.1`;
}

async function commitStage(client: PrismaClient, pack: Pack, rubrics: Rubrics, product: DataProduct, stage: number, qs: QueryService): Promise<void> {
  const facts = await stageEvidence(client, pack, rubrics, product, stage, qs);
  for (const type of stageDef(stage).artifacts) {
    await commitArtifact(client, pack, { productId: product.id, type, content: blueprint(pack, product, type, facts), committedBy: product.owner, message: `Seeded ${type} from the ${pack.manifest.name} pack` });
  }
}

async function approveGate(client: PrismaClient, pack: Pack, product: DataProduct, stage: number): Promise<void> {
  const def = stageDef(stage).gate;
  if (!def) return;
  const gate = await client.gate.findUnique({ where: { productId_stage: { productId: product.id, stage } } });
  if (!gate) throw new LifecycleError(`Gate ${stage} missing for ${product.id}`);
  const used = new Set<string>();
  let state = 'IN_REVIEW';
  for (let i = 0; i < 5 && state === 'IN_REVIEW'; i++) {
    const missing = def.roles.find((r) => !pack.personas.some((p) => used.has(p.id) && p.roles.includes(r))) ?? def.roles[0];
    const persona = pack.personas.find((p) => !used.has(p.id) && missing && p.roles.includes(missing)) ?? pack.personas.find((p) => !used.has(p.id) && p.roles.some((r) => def.roles.includes(r)));
    if (!persona) throw new LifecycleError(`No seeded persona can approve gate ${stage} (${def.roles.join(', ')})`);
    used.add(persona.id);
    state = (await recordDecision(client, pack, { subjectType: 'GATE', subjectId: gate.id, actor: { kind: 'HUMAN', personaId: persona.id }, outcome: 'APPROVE', rationale: `Seeded approval: ${stageDef(stage).name} evidence reviewed.` })).state;
  }
  if (state !== 'APPROVED') throw new LifecycleError(`Gate ${stage} for ${product.id} did not reach quorum during seeding`);
}

export async function seedLifecycle(client: PrismaClient, pack: Pack, rubrics: Rubrics, qs: QueryService): Promise<{ products: number; gates: number }> {
  let gates = 0;
  for (const product of pack.products) {
    await ensureStage(client, product.id, 1);
    for (let stage = 1; stage < product.seed_stage; stage++) {
      await commitStage(client, pack, rubrics, product, stage, qs);
      if (stage === 11) {
        const checks = await evaluateAndStoreChecks(client, pack, rubrics, product.id, { qs });
        await commitArtifact(client, pack, { productId: product.id, type: 'certification-scorecard', content: { checks: checks.map((c) => ({ check: c.label, status: c.status, detail: c.detail })), datsis: [] }, committedBy: product.owner, message: 'Certification checks evaluated' });
      }
      try {
        await submitForReview(client, pack, rubrics, product.id, stage, product.owner, { qs });
      } catch (e) {
        if (e instanceof LifecycleError && e.criteria.length) throw new LifecycleError(`${product.id} stage ${stage}: ${e.criteria.filter((c) => !c.ok).map((c) => `${c.label} — ${c.detail}`).join('; ')}`);
        throw e;
      }
      await approveGate(client, pack, product, stage);
      gates += 1;
    }
    // The current stage: drafted by the owner, or (lifecycle demo) left to the stage agent's open proposals.
    const current = product.seed_stage;
    if (current === 11) {
      const checks = await evaluateAndStoreChecks(client, pack, rubrics, product.id, { qs });
      await commitArtifact(client, pack, { productId: product.id, type: 'certification-scorecard', content: { checks: checks.map((c) => ({ check: c.label, status: c.status, detail: c.detail })), datsis: [] }, committedBy: product.owner, message: 'Certification checks evaluated' });
    } else if (product.lifecycle_seed.open_proposals) {
      await runLifecycleAgent(client, pack, rubrics, { productId: product.id, stage: current, trigger: 'STAGE_ENTRY', requestedBy: product.owner, qs });
    } else {
      await commitStage(client, pack, rubrics, product, current, qs);
    }
    const row = await client.dataProduct.findUnique({ where: { id: product.id } });
    if (row?.status !== product.initial_status || row.currentStage !== product.seed_stage || statusForStage(product.seed_stage) !== product.initial_status) {
      throw new LifecycleError(`${product.id} seeded to ${row?.status}@${row?.currentStage}, pack declares ${product.initial_status}@${product.seed_stage}`);
    }
  }
  return { products: pack.products.length, gates };
}
