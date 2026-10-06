import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import { runProductQuality } from '@/lib/lifecycle/quality';
import { productSensitivity } from '@/lib/marketplace/catalog';
import type { Pack, Rubrics } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';

/**
 * Seeds one pack (idempotent: replaces the pack's seeded rows). Phase 4 seeds product and agent records
 * with their pack status (Phase 5 replaces this with lifecycle-driven seeding), demand items and an
 * initial quality snapshot per product computed by the real DQ engine when the warehouse is available.
 */
export async function seedPack(prisma: PrismaClient, pack: Pack, opts: { rubrics?: Rubrics; qs?: QueryService } = {}): Promise<{ personas: number; entitlements: number; products: number; agents: number; snapshots: number }> {
  const packId = pack.manifest.id;
  const personaIds = pack.personas.map((p) => p.id);
  const productIds = pack.products.map((p) => p.id);

  // Reset this pack's mutable demo state (seeding is a reset; the running app never deletes rows).
  await prisma.decision.deleteMany({ where: { packId } });
  await prisma.accessRequest.deleteMany({ where: { packId } });
  await prisma.entitlement.deleteMany({ where: { personaId: { in: personaIds } } });
  await prisma.demandVote.deleteMany({ where: { demandId: { startsWith: `DM-${pack.manifest.code}-` } } });
  await prisma.demandItem.deleteMany({ where: { packId } });
  await prisma.qualityScoreSnapshot.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.qualityRuleResult.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.dataProduct.deleteMany({ where: { packId } });
  await prisma.agent.deleteMany({ where: { packId } });
  await prisma.persona.deleteMany({ where: { packId } });

  await prisma.persona.createMany({
    data: pack.personas.map((p) => ({
      id: p.id,
      packId,
      archetype: p.archetype,
      name: p.name,
      title: p.title,
      domain: p.domain,
      rolesJson: JSON.stringify(p.roles),
      rowFilterJson: p.row_filter ? JSON.stringify(p.row_filter) : null,
      unmaskedJson: JSON.stringify(p.unmasked),
      avatarSeed: p.id,
    })),
  });
  const grants = pack.policies.grants.flatMap((g) => [
    ...g.products.map((id) => ({ personaId: g.persona, subjectType: 'PRODUCT', subjectId: id, purpose: 'Initial demo entitlement', grantedVia: 'SEED' })),
    ...g.agents.map((id) => ({ personaId: g.persona, subjectType: 'AGENT', subjectId: id, purpose: 'Initial demo entitlement', grantedVia: 'SEED' })),
  ]);
  await prisma.entitlement.createMany({ data: grants });

  const certDemo = pack.manifest.story_roles.certDemoProduct;
  await prisma.dataProduct.createMany({
    data: pack.products.map((p) => ({
      id: p.id,
      packId,
      name: p.name,
      domain: p.domain,
      archetype: p.archetype,
      tier: 'unrated',
      status: p.initial_status,
      currentStage: p.seed_stage,
      semanticVersion: p.version,
      ownerPersonaId: p.owner,
      stewardPersonaId: p.steward,
      description: p.description,
      purpose: p.purpose,
      decisionJson: JSON.stringify(p.decision),
      sampleQuestionsJson: JSON.stringify(p.sample_questions),
      semanticView: p.semantic_view,
      outputPortsJson: JSON.stringify(p.output_ports),
      slaJson: JSON.stringify(p.sla),
      sensitivityJson: JSON.stringify(productSensitivity(pack, p)),
      kpiIdsJson: JSON.stringify(p.kpis),
      upstreamJson: JSON.stringify(p.upstream),
      isCertDemo: p.id === certDemo,
    })),
  });
  await prisma.agent.createMany({
    data: pack.agents.map((a) => ({ id: a.id, packId, family: 'DOMAIN', name: a.name, domain: a.domain, status: a.status, ownerPersonaId: a.owner, manifestJson: JSON.stringify(a) })),
  });
  await prisma.demandItem.createMany({
    data: pack.demand.demand_items.map((d) => ({ id: d.id, packId, kind: d.kind.toUpperCase(), title: d.title, description: d.description, votes: d.votes, state: 'OPEN', createdBy: d.requested_by })),
  });

  let snapshots = 0;
  if (opts.qs && opts.rubrics) {
    for (const p of pack.products) {
      const q = await runProductQuality(pack, opts.rubrics, opts.qs, p);
      if (q.results.length === 0) continue;
      await prisma.qualityRuleResult.createMany({ data: q.results.map((r) => ({ productId: p.id, ruleId: r.ruleId, dimension: r.dimension, passed: r.passed, observed: r.observed, threshold: r.threshold })) });
      await prisma.qualityScoreSnapshot.create({ data: { productId: p.id, score: q.score, dimensionsJson: JSON.stringify(q.dimensions), rubricVersion: opts.rubrics.version } });
      await prisma.dataProduct.update({ where: { id: p.id }, data: { tier: q.tier } });
      snapshots += 1;
    }
  }
  await appendAudit(prisma, {
    packId,
    actorType: 'SYSTEM',
    actorId: 'seed',
    action: 'PACK_SEEDED',
    subjectType: 'PACK',
    subjectId: packId,
    detail: { version: pack.manifest.version, personas: personaIds.length, entitlements: grants.length, products: productIds.length, agents: pack.agents.length, qualitySnapshots: snapshots },
  });
  return { personas: personaIds.length, entitlements: grants.length, products: productIds.length, agents: pack.agents.length, snapshots };
}
