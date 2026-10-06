import type { PrismaClient } from '@prisma/client';
import { appendAudit } from '@/lib/db/audit';
import { runProductQuality } from '@/lib/lifecycle/quality';
import { seedLifecycle, seedVersion } from '@/lib/lifecycle/seed';
import { productSensitivity } from '@/lib/marketplace/catalog';
import { duplicateCandidates } from '@/lib/packs/similarity';
import type { Pack, Rubrics } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';
import { respondScripted } from '@/lib/agents/scripted/respond';
import { principalFor } from '@/lib/query/principal';

/**
 * Seeds one pack (idempotent: replaces the pack's seeded rows): personas, entitlements, agent records,
 * demand and intake requests, a quality snapshot per product from the real DQ engine, and then drives
 * every product through the lifecycle engine to its seed stage (status and version are engine outcomes).
 * Without a built warehouse the lifecycle cannot run its real checks: products stay Draft at Stage 1
 * (statuses are only ever reached through recordDecision(), invariant I04).
 */
export async function seedPack(prisma: PrismaClient, pack: Pack, opts: { rubrics?: Rubrics; qs?: QueryService } = {}): Promise<{ personas: number; entitlements: number; products: number; agents: number; snapshots: number; gates: number }> {
  const packId = pack.manifest.id;
  const personaIds = pack.personas.map((p) => p.id);
  // Every product of this pack, including ones created in Product Studio since the last seed.
  const productIds = [...new Set([...pack.products.map((p) => p.id), ...(await prisma.dataProduct.findMany({ where: { packId }, select: { id: true } })).map((p) => p.id)])];

  // Reset this pack's mutable demo state (seeding is a reset; the running app never deletes rows).
  // Lifecycle rows are keyed by product id; clear by the pack's id prefix so rows of products removed
  // by an earlier seed (studio-created ones) never collide with new ids.
  const mine = { OR: [{ productId: { in: productIds } }, { productId: { startsWith: `DP-${pack.manifest.code}-` } }] };
  const gateIds = (await prisma.gate.findMany({ where: mine, select: { id: true } })).map((g) => g.id);
  const artifactIds = (await prisma.artifact.findMany({ where: mine, select: { id: true } })).map((a) => a.id);
  const versionIds = (await prisma.artifactVersion.findMany({ where: { artifactId: { in: artifactIds } }, select: { id: true } })).map((v) => v.id);
  await prisma.fieldProvenance.deleteMany({ where: { versionId: { in: versionIds } } });
  await prisma.gateEvidence.deleteMany({ where: { gateId: { in: gateIds } } });
  await prisma.artifactVersion.deleteMany({ where: { id: { in: versionIds } } });
  await prisma.artifact.deleteMany({ where: { id: { in: artifactIds } } });
  await prisma.gate.deleteMany({ where: { id: { in: gateIds } } });
  await prisma.stageRun.deleteMany({ where: mine });
  await prisma.agentProposal.deleteMany({ where: mine });
  await prisma.agentAction.deleteMany({ where: { packId } });
  await prisma.autopilotRun.deleteMany({ where: mine });
  await prisma.certificationCheckResult.deleteMany({ where: mine });
  await prisma.appliedFix.deleteMany({ where: { packId } });
  await prisma.knowledgeOverlay.deleteMany({ where: { packId } });
  await prisma.task.deleteMany({ where: { packId } });
  await prisma.comment.deleteMany({ where: mine });
  await prisma.productRequest.deleteMany({ where: { packId } });
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
  await prisma.incident.deleteMany({ where: { packId } });
  await prisma.qualityFixRun.deleteMany({ where: { packId } });
  await prisma.readinessAssessment.deleteMany({ where: { packId } });
  await prisma.prioritisationOverride.deleteMany({ where: { packId } });

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
  const lifecycle = Boolean(opts.qs && opts.rubrics);
  await prisma.dataProduct.createMany({
    data: pack.products.map((p) => ({
      id: p.id,
      packId,
      name: p.name,
      domain: p.domain,
      archetype: p.archetype,
      tier: 'unrated',
      status: 'DRAFT',
      currentStage: 1,
      semanticVersion: lifecycle ? seedVersion(p) : '0.1.0',
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
  let gates = 0;
  if (opts.qs && opts.rubrics) gates = (await seedLifecycle(prisma, pack, opts.rubrics, opts.qs)).gates;
  await seedIntake(prisma, pack, opts.rubrics);

  await appendAudit(prisma, {
    packId,
    actorType: 'SYSTEM',
    actorId: 'seed',
    action: 'PACK_SEEDED',
    subjectType: 'PACK',
    subjectId: packId,
    detail: { version: pack.manifest.version, personas: personaIds.length, entitlements: grants.length, products: pack.products.length, agents: pack.agents.length, qualitySnapshots: snapshots, gatesApproved: gates },
  });
  if (opts.rubrics && opts.qs) await seedFeedback(prisma, pack, opts.rubrics, opts.qs);
  return { personas: personaIds.length, entitlements: grants.length, products: pack.products.length, agents: pack.agents.length, snapshots, gates };
}

/**
 * The Agent Quality story's thumbs-down: persona B asked the quality-fix agent its feedback question. Answer
 * records are append-only, so a re-seed reuses the record and resets its feedback to NEW.
 */
async function seedFeedback(prisma: PrismaClient, pack: Pack, rubrics: Rubrics, qs: QueryService): Promise<void> {
  const agent = pack.agents.find((a) => a.id === pack.manifest.story_roles.qualityFixAgent);
  const fix = agent?.quality_fix;
  const asker = pack.personas.find((p) => p.archetype === 'B');
  if (!agent || !fix || !asker) return;
  const packId = pack.manifest.id;
  let record = await prisma.answerRecord.findFirst({ where: { packId, agentId: agent.id, personaId: asker.id, question: fix.feedback_question }, select: { id: true } });
  if (!record) {
    const a = await respondScripted(agent.id, fix.feedback_question, { pack, rubrics, qs, who: principalFor(pack, asker.id) });
    record = await prisma.answerRecord.create({
      data: { packId, agentId: agent.id, personaId: asker.id, question: fix.feedback_question, kind: a.kind, mode: a.mode, scenarioId: a.scenarioId ?? null, metricQueryJson: a.metricQuery ? JSON.stringify(a.metricQuery) : null, answerJson: JSON.stringify(a), citationsJson: JSON.stringify(a.citations), traceJson: JSON.stringify(a.trace), confidence: a.confidence, latencyMs: 0 },
      select: { id: true },
    });
  }
  const reason = 'This did not answer what I asked.';
  const fb = await prisma.answerFeedback.findFirst({ where: { answerId: record.id, personaId: asker.id } });
  if (fb) await prisma.answerFeedback.update({ where: { id: fb.id }, data: { state: 'NEW', fixId: null, rating: -1, reason } });
  else await prisma.answerFeedback.create({ data: { answerId: record.id, personaId: asker.id, rating: -1, reason, state: 'NEW' } });
}

/** Seeded intake requests (demand.yaml) with their duplicate candidates computed by the real detector. */
async function seedIntake(prisma: PrismaClient, pack: Pack, rubrics?: Rubrics): Promise<void> {
  for (const r of pack.demand.requests) {
    const dups = rubrics ? duplicateCandidates(pack, rubrics, [r.title, r.decision, ...r.questions].join(' '), [], r.questions).filter((d) => d.kind !== 'demand') : [];
    await prisma.productRequest.create({
      data: {
        reference: r.id,
        packId: pack.manifest.id,
        title: r.title,
        requesterId: r.requester,
        state: r.status === 'IN_TRIAGE' ? 'TRIAGE' : r.status,
        decisionJson: JSON.stringify({ decision: r.decision, decider: r.decider, cadence: r.cadence, workaround: r.workaround }),
        questionsJson: JSON.stringify(r.questions),
        stakes: r.stakes,
        freshness: r.freshness,
        duplicateCandidatesJson: JSON.stringify(dups),
        slaDueAt: new Date(Date.parse(`${pack.manifest.asOf}T09:00:00Z`) + (rubrics?.intake.triage_sla_hours ?? 72) * 3_600_000),
      },
    });
  }
}
