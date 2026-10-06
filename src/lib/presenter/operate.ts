/**
 * Run (operate) orchestration for the operator screens: Break something / resolve (with DQ re-runs), the
 * health board, the agent-quality loop (feedback → overlay fix → re-eval), cost & value, impact and audit.
 */
import { respondScripted } from '@/lib/agents/scripted/respond';
import { db } from '@/lib/db';
import { chainOrder, verifyChain } from '@/lib/db/audit';
import { productModel } from '@/lib/lifecycle/product-model';
import { runProductQuality } from '@/lib/lifecycle/quality';
import { computeCost, type CostLevers, defaultLevers, valueRollup } from '@/lib/operate/cost';
import { healthRow, type HealthRow } from '@/lib/operate/health';
import { impactOf, type ImpactTarget } from '@/lib/operate/impact';
import { breakIncident, listIncidents, resolveIncident } from '@/lib/operate/incidents';
import { type FixType, fixResolves, qualityScorePct, writeOverlay } from '@/lib/operate/quality';
import { getPack, getRubrics } from '@/lib/packs/registry';
import type { AgentManifest, Pack } from '@/lib/packs/schema';
import { openTemplates } from '@/lib/query/incidents';
import { livePack, runEvaluation } from './factory';
import { governedService, policyState, principalForPersona } from './governed';

/** Re-runs the DQ rules of products (after Break / Resolve) and stores the results as a new snapshot. */
export async function rerunQuality(packId: string, productIds: string[]): Promise<void> {
  const pack = getPack(packId);
  const rubrics = getRubrics();
  const prisma = db();
  const qs = await governedService(packId);
  for (const id of productIds) {
    const row = await prisma.dataProduct.findUnique({ where: { id } });
    if (!row) continue;
    const q = await runProductQuality(pack, rubrics, qs, productModel(pack, row));
    if (!q.results.length) continue;
    await prisma.qualityRuleResult.createMany({ data: q.results.map((r) => ({ productId: id, ruleId: r.ruleId, dimension: r.dimension, passed: r.passed, observed: r.observed, threshold: r.threshold })) });
    await prisma.qualityScoreSnapshot.create({ data: { productId: id, score: q.score, dimensionsJson: JSON.stringify(q.dimensions), rubricVersion: rubrics.version } });
  }
}

export async function breakNow(packId: string, templateId: string, personaId: string): Promise<string> {
  const pack = getPack(packId);
  const id = await breakIncident(db(), pack, templateId, personaId);
  await rerunQuality(packId, pack.incidents.find((t) => t.id === templateId)?.affects.products ?? []);
  return id;
}

export async function resolveNow(packId: string, incidentId: string, personaId: string, now: Date) {
  const pack = getPack(packId);
  const pm = await resolveIncident(db(), pack, incidentId, personaId, now);
  await rerunQuality(packId, pack.incidents.find((t) => t.id === pm.templateId)?.affects.products ?? []);
  return pm;
}

export async function incidents(packId: string) {
  return listIncidents(db(), getPack(packId));
}

export async function healthBoard(packId: string): Promise<HealthRow[]> {
  const pack = getPack(packId);
  const prisma = db();
  const state = await policyState(packId);
  const open = openTemplates(pack, state.incidents);
  const rows: HealthRow[] = [];
  for (const p of pack.products) {
    const [snap, results] = await Promise.all([
      prisma.qualityScoreSnapshot.findFirst({ where: { productId: p.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      prisma.qualityRuleResult.findMany({ where: { productId: p.id }, orderBy: [{ evaluatedAt: 'desc' }, { id: 'desc' }] }),
    ]);
    const latest = new Map<string, (typeof results)[number]>();
    for (const r of results) if (!latest.has(r.ruleId)) latest.set(r.ruleId, r);
    rows.push(healthRow(pack, p.id, { rules: [...latest.values()], dqScore: snap?.score ?? null, open }));
  }
  return rows;
}

// ───────── Agent Quality ─────────

export interface FeedbackItem {
  id: string;
  answerId: string;
  agentId: string;
  question: string;
  personaId: string;
  reason: string | null;
  state: string;
  createdAt: string;
  fix: { before: number; after: number; fixType: string } | null;
}

export async function feedbackInbox(packId: string): Promise<FeedbackItem[]> {
  const prisma = db();
  const answers = await prisma.answerRecord.findMany({ where: { packId }, select: { id: true, agentId: true, question: true } });
  const byId = new Map(answers.map((a) => [a.id, a]));
  const rows = await prisma.answerFeedback.findMany({ where: { answerId: { in: [...byId.keys()] }, rating: -1 }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const fixes = await prisma.qualityFixRun.findMany({ where: { packId, feedbackId: { in: rows.map((r) => r.id) } } });
  const fixOf = (id: string) => {
    const f = fixes.find((x) => x.feedbackId === id);
    return f ? { before: f.evalBefore, after: f.evalAfter, fixType: f.fixType } : null;
  };
  return rows.map((r) => ({
    fix: fixOf(r.id), id: r.id, answerId: r.answerId, agentId: byId.get(r.answerId)?.agentId ?? '', question: byId.get(r.answerId)?.question ?? '', personaId: r.personaId, reason: r.reason, state: r.state, createdAt: r.createdAt.toISOString() }));
}

/** Asks the agent the feedback question as the steward and checks whether the fix resolves it. */
async function feedbackResolved(pack: Pack, agent: AgentManifest): Promise<boolean | null> {
  const fix = agent.quality_fix;
  if (!fix) return null;
  const steward = pack.personas.find((p) => p.archetype === 'D') ?? pack.personas[0];
  if (!steward) return null;
  const who = await principalForPersona(pack.manifest.id, steward.id);
  const a = await respondScripted(agent.id, fix.feedback_question, { pack, rubrics: getRubrics(), qs: await governedService(pack.manifest.id), who });
  return fixResolves(a, fix.fix.type, fix.fix.payload);
}

export interface Scorecard {
  agentId: string;
  name: string;
  status: string;
  scorePct: number | null;
  harnessPct: number | null;
  suites: Record<string, { score: number | null; threshold: number; passed: boolean }>;
  history: { at: string; overall: number }[];
  fixes: { at: string; fixType: string; before: number; after: number }[];
  hasScriptedFix: boolean;
}

export async function scorecards(packId: string): Promise<Scorecard[]> {
  const pack = await livePack(packId);
  const prisma = db();
  const out: Scorecard[] = [];
  for (const a of pack.agents) {
    const runs = await prisma.evalRun.findMany({ where: { packId, agentId: a.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { overall: true, suitesJson: true, createdAt: true } });
    const last = runs.at(-1);
    const fixes = await prisma.qualityFixRun.findMany({ where: { packId, agentId: a.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const resolved = a.quality_fix ? await feedbackResolved(pack, a) : null;
    out.push({
      agentId: a.id,
      name: a.name,
      status: a.status,
      scorePct: qualityScorePct(a, last?.overall ?? null, resolved),
      harnessPct: last ? Math.round(last.overall * 1000) / 10 : null,
      suites: last ? (JSON.parse(last.suitesJson) as Scorecard['suites']) : {},
      history: runs.map((r) => ({ at: r.createdAt.toISOString(), overall: r.overall })),
      fixes: fixes.map((f) => ({ at: f.createdAt.toISOString(), fixType: f.fixType, before: f.evalBefore, after: f.evalAfter })),
      hasScriptedFix: Boolean(a.quality_fix),
    });
  }
  return out;
}

/**
 * Applies a fix as a versioned knowledge overlay, re-runs the eval and records the before/after. With no
 * explicit fix, the agent's pack-scripted fix is used (the 88% → 94% moment).
 */
export async function applyQualityFix(packId: string, agentId: string, personaId: string, opts: { feedbackId?: string; type?: FixType; payload?: Record<string, unknown> } = {}) {
  const prisma = db();
  const before = await livePack(packId);
  const agent = before.agents.find((a) => a.id === agentId);
  if (!agent) throw new Error('Unknown agent');
  const type = opts.type ?? agent.quality_fix?.fix.type;
  const payload = opts.payload ?? agent.quality_fix?.fix.payload;
  if (!type || !payload) throw new Error(`${agent.name} has no scripted fix; describe one.`);
  const beforeResolved = await feedbackResolved(before, agent);
  const beforeEval = await runEvaluation(packId, agentId);
  const overlay = await writeOverlay(prisma, packId, type, payload, personaId, opts.feedbackId ?? null);
  const after = await livePack(packId);
  const afterAgent = after.agents.find((a) => a.id === agentId) ?? agent;
  const afterResolved = await feedbackResolved(after, afterAgent);
  const afterEval = await runEvaluation(packId, agentId);
  const evalBefore = qualityScorePct(agent, beforeEval.overall, beforeResolved) ?? 0;
  const evalAfter = qualityScorePct(afterAgent, afterEval.overall, afterResolved) ?? 0;
  await prisma.qualityFixRun.create({ data: { packId, agentId, feedbackId: opts.feedbackId ?? null, overlayId: overlay.id, fixType: type, evalBefore, evalAfter, appliedBy: personaId } });
  if (opts.feedbackId) await prisma.answerFeedback.update({ where: { id: opts.feedbackId }, data: { state: 'FIXED', fixId: overlay.id } });
  return { overlayId: overlay.id, version: overlay.version, evalBefore, evalAfter, resolved: afterResolved };
}

export async function dismissFeedback(feedbackId: string): Promise<void> {
  await db().answerFeedback.update({ where: { id: feedbackId }, data: { state: 'DISMISSED' } });
}

// ───────── Cost & Value, Impact, Audit ─────────

export async function costAndValue(packId: string, levers?: Partial<CostLevers>) {
  const pack = getPack(packId);
  const lv = { ...defaultLevers(pack), ...levers };
  const cost = computeCost(pack, lv);
  const answers = await db().answerRecord.findMany({ where: { packId, mode: 'live' }, select: { agentId: true, tokensIn: true, tokensOut: true, costUsd: true } }).catch(() => []);
  const actuals = new Map<string, { answers: number; tokens: number; usd: number }>();
  for (const a of answers) {
    const cur = actuals.get(a.agentId) ?? { answers: 0, tokens: 0, usd: 0 };
    actuals.set(a.agentId, { answers: cur.answers + 1, tokens: cur.tokens + a.tokensIn + a.tokensOut, usd: cur.usd + a.costUsd });
  }
  return { levers: lv, defaults: defaultLevers(pack), cost, value: valueRollup(pack, cost), liveActuals: Object.fromEntries(actuals) };
}

export async function impact(packId: string, target: ImpactTarget) {
  const pack = getPack(packId);
  const state = await policyState(packId);
  return impactOf(pack, getRubrics(), target, (id) => state.products?.[id]?.status ?? pack.products.find((p) => p.id === id)?.initial_status ?? 'DRAFT');
}

export interface AuditFilter {
  actorType?: 'HUMAN' | 'AGENT' | 'SYSTEM';
  subjectType?: string;
  actorId?: string;
}

export async function auditStream(packId: string, filter: AuditFilter = {}, take = 200) {
  const prisma = db();
  const all = await prisma.auditEvent.findMany({ where: { packId } });
  const chain = verifyChain(all);
  const ordered = (chainOrder(all) ?? [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())).reverse();
  const events = ordered.filter((e) => (!filter.actorType || e.actorType === filter.actorType) && (!filter.subjectType || e.subjectType === filter.subjectType) && (!filter.actorId || e.actorId === filter.actorId)).slice(0, take);
  return { chain, total: all.length, events: events.map((e) => ({ id: e.id, at: e.createdAt.toISOString(), actorType: e.actorType, actorId: e.actorId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, detail: e.detailJson, hash: e.hash })) };
}
