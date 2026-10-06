/**
 * Agent Factory persistence: drafts live in the Agent table (fromPack = false) with a FactoryAgent JSON;
 * evaluation runs, publish-gate runs and release steps are recorded; `livePack()` merges released (and,
 * for evaluation, draft) factory agents into the pack the engines and screens use.
 */
import { createHash } from 'node:crypto';
import { evaluateAgent, type EvalReport } from '@/lib/agents/eval';
import { type FactoryAgent, INSTRUCTION_KINDS, publishGate, withFactoryAgents } from '@/lib/agents/factory';
import type { GoldenFile } from '@/lib/agents/golden';
import { db } from '@/lib/db';
import { appendAudit, canonicalJson } from '@/lib/db/audit';
import { recordDecision } from '@/lib/lifecycle/decisions';
import { getAdversarial, getPack, getRubrics, packsDir } from '@/lib/packs/registry';
import type { AgentManifest, Pack } from '@/lib/packs/schema';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { governedService, policyState } from './governed';

export async function factoryAgents(packId: string, opts: { includeDrafts?: boolean } = {}): Promise<FactoryAgent[]> {
  try {
    const rows = await db().agent.findMany({ where: { packId, fromPack: false, ...(opts.includeDrafts ? {} : { status: { not: 'DRAFT' } }) }, orderBy: { id: 'asc' } });
    return rows.map((r) => {
      const fa = JSON.parse(r.manifestJson) as FactoryAgent;
      return { ...fa, manifest: { ...fa.manifest, status: (r.status === 'DRAFT' ? 'PILOT' : r.status) as AgentManifest['status'] } };
    });
  } catch {
    return [];
  }
}

/** The pack plus released factory agents (drafts too when asked) — what Ask and Marketplace serve. */
export async function livePack(packId: string, opts: { includeDrafts?: boolean } = {}): Promise<Pack> {
  return withFactoryAgents(getPack(packId), await factoryAgents(packId, opts));
}

export function blankAgent(pack: Pack, id: string, ownerId: string): FactoryAgent {
  return {
    manifest: {
      id,
      name: 'New agent',
      domain: 'Factory',
      status: 'PILOT',
      owner: ownerId,
      on_call: 'Data platform team',
      avatar: { icon: 'bot', hue: 280 },
      capability: 'Describe what this agent answers.',
      personas_served: ['Business user'],
      out_of_scope: [],
      products: [],
      tools: [{ tool: 'semantic_query', views: [], row_limit: 500 }, { tool: 'get_definition' }, { tool: 'get_product_status' }],
      kpi_coverage: [],
      instructions: INSTRUCTION_KINDS.map((k) => `INS-${pack.manifest.code}-${id.split('-').pop()}-${k[0]?.toUpperCase()}`),
      guardrails: { citations_required: true, refuse_customer_level: true, pii_output: 'deny', max_followups: 3 },
      budgets: { cost_per_answer_usd: 0.05, p95_latency_ms: 8000, max_tool_rounds: 5 },
      eval: { golden_min: 0.8, groundedness_min: 1, boundary_min: 0.9, adversarial_min: 1, entitlement_min: 1 },
      scenarios: [],
    },
    instructions: { persona: '', response: '', guardrail: '', orchestration: '' },
  };
}

export async function createDraft(packId: string, personaId: string): Promise<string> {
  const pack = getPack(packId);
  const prisma = db();
  const n = await prisma.agent.count({ where: { packId, fromPack: false } });
  const id = `AG-${pack.manifest.code}-${String(101 + n).padStart(3, '0')}`;
  const fa = blankAgent(pack, id, personaId);
  await prisma.agent.create({ data: { id, packId, family: 'DOMAIN', name: fa.manifest.name, domain: fa.manifest.domain, status: 'DRAFT', ownerPersonaId: personaId, manifestJson: JSON.stringify(fa), fromPack: false } });
  await appendAudit(prisma, { packId, actorType: 'HUMAN', actorId: personaId, action: 'AGENT_DRAFT_CREATED', subjectType: 'AGENT', subjectId: id, detail: {} });
  return id;
}

export async function loadDraft(packId: string, id: string): Promise<{ agent: FactoryAgent; status: string; version: number } | null> {
  const row = await db().agent.findUnique({ where: { id } }).catch(() => null);
  if (!row || row.packId !== packId || row.fromPack) return null;
  return { agent: JSON.parse(row.manifestJson) as FactoryAgent, status: row.status, version: row.currentVersion };
}

/** Saves a draft (editing a released agent starts a new version as a draft again). */
export async function saveDraft(packId: string, id: string, agent: FactoryAgent, personaId: string): Promise<void> {
  const prisma = db();
  const row = await prisma.agent.findUnique({ where: { id } });
  if (!row || row.packId !== packId || row.fromPack) throw new Error('Unknown draft');
  const views = getPack(packId).products.filter((p) => agent.manifest.products.some((b) => b.id === p.id)).flatMap((p) => (p.semantic_view ? [p.semantic_view] : []));
  agent.manifest.tools = agent.manifest.tools.map((t) => (t.tool === 'semantic_query' ? { ...t, views } : t));
  await prisma.agent.update({ where: { id }, data: { name: agent.manifest.name, domain: agent.manifest.domain, manifestJson: JSON.stringify(agent), ...(row.status === 'DRAFT' ? {} : { status: 'DRAFT', currentVersion: row.currentVersion + 1 }) } });
  await appendAudit(prisma, { packId, actorType: 'HUMAN', actorId: personaId, action: 'AGENT_DRAFT_SAVED', subjectType: 'AGENT', subjectId: id, detail: { name: agent.manifest.name } });
}

function golden(packId: string): GoldenFile | undefined {
  const f = join(packsDir(), packId, 'golden.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as GoldenFile) : undefined;
}

export async function runEvaluation(packId: string, agentId: string): Promise<EvalReport> {
  const pack = await livePack(packId, { includeDrafts: true });
  const agent = pack.agents.find((a) => a.id === agentId);
  if (!agent) throw new Error('Unknown agent');
  const report = await evaluateAgent(agent, { pack, rubrics: getRubrics(), qs: await governedService(packId), golden: golden(packId), adversarial: getAdversarial() });
  const row = await db().agent.findUnique({ where: { id: agentId } });
  await db().evalRun.create({
    data: {
      packId,
      agentId,
      agentVersion: row?.currentVersion ?? 1,
      mode: report.mode,
      suitesJson: JSON.stringify(report.suites),
      overall: report.overall,
      cases: { create: report.cases.map((c) => ({ suite: c.suite, caseId: c.caseId, question: c.question, expectedJson: JSON.stringify(c.expected), actualJson: JSON.stringify(c.actual), pass: c.pass, reason: c.reason ?? null })) },
    },
  });
  return report;
}

export async function latestEval(agentId: string) {
  return db().evalRun.findFirst({ where: { agentId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { cases: true } }).catch(() => null);
}

export async function runPublishGate(packId: string, agentId: string) {
  const prisma = db();
  const draft = await loadDraft(packId, agentId);
  if (!draft) throw new Error('Unknown agent');
  const pack = await livePack(packId, { includeDrafts: true });
  const state = await policyState(packId);
  const ev = await latestEval(agentId);
  const report: EvalReport | null = ev && ev.agentVersion === draft.version ? { agentId, mode: 'scripted', suites: JSON.parse(ev.suitesJson) as EvalReport['suites'], overall: ev.overall, passed: Object.values(JSON.parse(ev.suitesJson) as EvalReport['suites']).every((s) => s.passed), cases: [] } : null;
  const approval = await prisma.decision.findFirst({ where: { subjectType: 'AGENT_PUBLISH', subjectId: agentId, outcome: 'APPROVE' } });
  const checks = publishGate(pack, draft.agent, { productStatus: Object.fromEntries(Object.entries(state.products ?? {}).map(([k, v]) => [k, v.status])), eval: report, humanApproval: Boolean(approval) });
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  await prisma.agentVersion.upsert({
    where: { agentId_version: { agentId, version: draft.version } },
    update: { manifestJson: JSON.stringify(draft.agent.manifest), manifestHash: hash(canonicalJson(draft.agent.manifest)), instructionsHash: hash(canonicalJson(draft.agent.instructions)) },
    create: { agentId, version: draft.version, manifestJson: JSON.stringify(draft.agent.manifest), manifestHash: hash(canonicalJson(draft.agent.manifest)), instructionsHash: hash(canonicalJson(draft.agent.instructions)), releaseState: 'candidate' },
  });
  await prisma.publishGateRun.create({ data: { agentId, agentVersion: draft.version, resultsJson: JSON.stringify(checks), passed: checks.every((c) => c.passed) } });
  return checks;
}

export async function approveRelease(packId: string, agentId: string, personaId: string, release: 'pilot' | 'canary' | 'production', rationale: string) {
  return recordDecision(db(), getPack(packId), { subjectType: 'AGENT_PUBLISH', subjectId: agentId, actor: { kind: 'HUMAN', personaId }, outcome: 'APPROVE', rationale: rationale || `Release to ${release}`, release });
}

/** Rollback is not an approval: it returns the agent to Pilot and marks the version rolled back. */
export async function rollback(packId: string, agentId: string, personaId: string): Promise<void> {
  const prisma = db();
  const row = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!row || row.packId !== packId || row.fromPack) throw new Error('Unknown agent');
  await prisma.agent.update({ where: { id: agentId }, data: { status: 'PILOT' } });
  await prisma.agentVersion.updateMany({ where: { agentId, version: row.currentVersion }, data: { releaseState: 'rolled_back', canaryPct: 0 } });
  await appendAudit(prisma, { packId, actorType: 'HUMAN', actorId: personaId, action: 'AGENT_ROLLED_BACK', subjectType: 'AGENT', subjectId: agentId, detail: { version: row.currentVersion } });
}
