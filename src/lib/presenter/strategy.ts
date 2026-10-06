/**
 * Strategy orchestration for the strategist screens: Knockout and Compare through the governed query path,
 * saved readiness assessments, the portfolio (scores, overrides, cost, adoption, value) and evidence-based
 * maturity.
 */
import { db } from '@/lib/db';
import { appendAudit } from '@/lib/db/audit';
import { latestChecks } from '@/lib/lifecycle/engine';
import { STAGES } from '@/lib/lifecycle/stages';
import { productSensitivity } from '@/lib/marketplace/catalog';
import { computeCost, defaultLevers } from '@/lib/operate/cost';
import { getPack, getRubrics } from '@/lib/packs/registry';
import type { KnockoutLayer } from '@/lib/packs/schema';
import type { Principal } from '@/lib/query/types';
import { runKnockout } from '@/lib/strategy/knockout';
import { type MaturityFacts, maturityFromFacts, overallMaturity } from '@/lib/strategy/maturity';
import { productInputs, rankWithOverrides, scoreProduct } from '@/lib/strategy/portfolio';
import { bandOf, DIMENSIONS, dimScore, overallScore } from '@/lib/strategy/readiness';
import { livePack } from './factory';
import { governedService } from './governed';

export async function knockout(packId: string, who: Principal, off: KnockoutLayer[]) {
  return runKnockout(getPack(packId), await governedService(packId), who, off);
}

const ALL_OFF: KnockoutLayer[] = ['silver', 'gold', 'semantic', 'glossary', 'context', 'governance'];

/** Compare: each governed answer next to the same question over the raw stack (every layer off). */
export async function compare(packId: string, who: Principal) {
  const [governed, raw] = await Promise.all([knockout(packId, who, []), knockout(packId, who, ALL_OFF)]);
  return governed.map((g) => {
    const r = raw.find((x) => x.id === g.id);
    return { governed: g, raw: r ?? null };
  });
}

// ───────── Readiness ─────────

export async function saveAssessment(packId: string, name: string, answers: Record<string, number>, personaId: string): Promise<string> {
  const rubrics = getRubrics();
  const overall = overallScore(answers);
  const scores = Object.fromEntries(DIMENSIONS.map((d) => [d.id, dimScore(d.id, answers) ?? null]));
  const row = await db().readinessAssessment.create({
    data: { packId, name: name.trim().slice(0, 80) || 'Assessment', answersJson: JSON.stringify(answers), scoresJson: JSON.stringify({ ...scores, overall: overall ?? null }), band: overall === undefined ? 'Not assessed' : bandOf(rubrics, overall), createdBy: personaId },
  });
  await appendAudit(db(), { packId, actorType: 'HUMAN', actorId: personaId, action: 'READINESS_SAVED', subjectType: 'READINESS', subjectId: row.id, detail: { name: row.name, overall: overall ?? null } });
  return row.id;
}

export async function assessments(packId: string) {
  const rows = await db().readinessAssessment.findMany({ where: { packId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }).catch(() => []);
  return rows.map((r) => ({ id: r.id, name: r.name, band: r.band, answers: JSON.parse(r.answersJson) as Record<string, number>, scores: JSON.parse(r.scoresJson) as Record<string, number | null>, at: r.createdAt.toISOString() }));
}

// ───────── Portfolio ─────────

export async function portfolio(packId: string, model: 'WSJF' | 'RICE' = getRubrics().prioritisation.model) {
  const pack = await livePack(packId);
  const rubrics = getRubrics();
  const prisma = db();
  const [live, overrides, answers] = await Promise.all([
    prisma.dataProduct.findMany({ where: { packId }, select: { id: true, status: true, currentStage: true } }).catch(() => []),
    prisma.prioritisationOverride.findMany({ where: { packId, model }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }).catch(() => []),
    prisma.answerRecord.groupBy({ by: ['agentId'], where: { packId }, _count: { _all: true } }).catch(() => []),
  ]);
  const latest = new Map<string, { score: number; reason: string; by: string }>();
  for (const o of overrides) if (!latest.has(o.productId)) latest.set(o.productId, { score: o.score, reason: o.reason, by: pack.personas.find((p) => p.id === o.personaId)?.name ?? o.personaId });
  const cost = computeCost(pack, defaultLevers(pack));
  const answeredBy = new Map(answers.map((a) => [a.agentId, a._count._all]));
  const rows = pack.products.map((p) => {
    const inputs = productInputs(pack, p, productSensitivity(pack, p).length);
    const reach = Math.max(1, p.consumers.length) * 40;
    return { item: { id: p.id, product: p, inputs }, model: scoreProduct(model, rubrics, inputs, reach) };
  });
  const ranked = rankWithOverrides(rows, latest);
  return ranked.map((r) => {
    const l = live.find((x) => x.id === r.item.id);
    const stage = l?.currentStage ?? r.item.product.seed_stage;
    const value = pack.value.find((v) => v.product === r.item.id);
    return {
      ...r,
      status: l?.status ?? r.item.product.initial_status,
      stage,
      phase: STAGES.find((s) => s.n === stage)?.phase ?? 'Discover',
      monthlyCost: cost.byProduct.find((c) => c.productId === r.item.id)?.usd ?? 0,
      adoption: pack.agents.filter((a) => a.products.some((b) => b.id === r.item.id)).reduce((n, a) => n + (answeredBy.get(a.id) ?? 0), 0),
      valueExpected: value?.annual_value_usd ?? null,
      valueRealised: value?.measured?.value_usd ?? null,
    };
  });
}

export async function overridePriority(packId: string, productId: string, model: 'WSJF' | 'RICE', score: number, reason: string, personaId: string): Promise<void> {
  if (!reason.trim()) throw new Error('An override needs a reason.');
  if (!Number.isFinite(score) || score < 0) throw new Error('The score must be a non-negative number.');
  if (!getPack(packId).products.some((p) => p.id === productId)) throw new Error('Unknown product');
  const row = await db().prioritisationOverride.create({ data: { packId, productId, model, score, reason: reason.trim().slice(0, 300), personaId } });
  await appendAudit(db(), { packId, actorType: 'HUMAN', actorId: personaId, action: 'PRIORITY_OVERRIDDEN', subjectType: 'DATA_PRODUCT', subjectId: productId, detail: { model, score, reason: row.reason } });
}

// ───────── Maturity ─────────

export async function maturity(packId: string) {
  const pack = await livePack(packId);
  const prisma = db();
  const share = (n: number, d: number) => (d ? n / d : 0);
  const products = await prisma.dataProduct.findMany({ where: { packId }, select: { id: true, status: true, currentStage: true } }).catch(() => []);
  let gated = 0;
  let certifiedClean = 0;
  for (const p of products) {
    const approved = await prisma.gate.count({ where: { productId: p.id, state: 'APPROVED' } });
    if (approved >= p.currentStage - 1) gated += 1;
    if (p.status === 'CERTIFIED') {
      const checks = await latestChecks(prisma, pack, p.id);
      if (checks?.every((c) => c.status === 'pass')) certifiedClean += 1;
    }
  }
  const proposals = await prisma.agentProposal.groupBy({ by: ['state'], where: { productId: { in: products.map((p) => p.id) } }, _count: { _all: true } }).catch(() => []);
  const count = (states: string[]) => proposals.filter((p) => states.includes(p.state)).reduce((n, p) => n + p._count._all, 0);
  const viewMetrics = new Set(pack.semantic.flatMap((v) => v.metrics.map((m) => m.name)));
  const vqMetrics = new Set(pack.verifiedQueries.filter((v) => v.status === 'active').flatMap((v) => v.query.metrics));
  const facts: MaturityFacts = {
    consumption: share(pack.products.filter((p) => p.decision.persona && p.sample_questions.length >= 3).length, pack.products.length),
    lifecycle: share(gated, products.length),
    semantic: share(pack.kpis.filter((k) => viewMetrics.has(k.metric) && vqMetrics.has(k.metric)).length, pack.kpis.length),
    governance: share(certifiedClean, products.filter((p) => p.status === 'CERTIFIED').length),
    automation: share(count(['ACCEPTED', 'EDITED']), count(['ACCEPTED', 'EDITED', 'REJECTED'])),
    operating: share(pack.value.filter((v) => v.measured).length, pack.value.length),
  };
  const levels = maturityFromFacts(facts);
  return { levels, overall: overallMaturity(levels) };
}
