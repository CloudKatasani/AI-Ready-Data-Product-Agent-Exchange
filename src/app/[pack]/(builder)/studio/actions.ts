'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { acceptAll, decideProposal, runLifecycleAgent } from '@/lib/lifecycle/agent-runs';
import type { ArtifactContent } from '@/lib/lifecycle/artifacts/registry';
import { cancelAutopilot, startAutopilot, stepAutopilot } from '@/lib/lifecycle/autopilot';
import { DecisionRefused, recordDecision } from '@/lib/lifecycle/decisions';
import { applyFix, commitArtifact, evaluateAndStoreChecks, latestVersions, LifecycleError, submitForReview } from '@/lib/lifecycle/engine';
import { profileProduct, profileSummary } from '@/lib/lifecycle/profiling';
import { productModel } from '@/lib/lifecycle/product-model';
import { runProductQuality } from '@/lib/lifecycle/quality';
import type { ArtifactType } from '@/lib/lifecycle/stages';
import { getPack, getRubrics, hasPack } from '@/lib/packs/registry';
import { governedService } from '@/lib/presenter/governed';
import { activePersona } from '../../_server/session';

export interface ActionResult {
  ok: boolean;
  message?: string;
  details?: string[];
}

async function ctx(packId: string) {
  if (!hasPack(packId)) throw new LifecycleError('Unknown pack');
  const pack = getPack(packId);
  return { pack, rubrics: getRubrics(), persona: await activePersona(pack), prisma: db() };
}

async function wrap(packId: string, productId: string, fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const r = await fn();
    revalidatePath(`/${packId}/studio/${productId}`, 'layout');
    revalidatePath(`/${packId}/studio`);
    revalidatePath(`/${packId}/marketplace`, 'layout');
    return r;
  } catch (e) {
    if (e instanceof LifecycleError) return { ok: false, message: e.message, details: e.criteria.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`) };
    if (e instanceof DecisionRefused) return { ok: false, message: e.message };
    throw e;
  }
}

async function qsOrUndefined(packId: string) {
  try {
    return await governedService(packId);
  } catch {
    return undefined;
  }
}

export async function saveArtifact(packId: string, productId: string, type: ArtifactType, content: ArtifactContent, message: string): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, persona, prisma } = await ctx(packId);
    const prev = (await latestVersions(prisma, productId)).get(type);
    const provenance: Record<string, { source: 'HUMAN' | 'AGENT'; agentId?: string; acceptedBy?: string }> = {};
    if (prev) {
      for (const p of await prisma.fieldProvenance.findMany({ where: { versionId: prev.versionId } })) {
        if (JSON.stringify(prev.content[p.fieldPath]) === JSON.stringify(content[p.fieldPath])) provenance[p.fieldPath] = { source: p.source as 'HUMAN' | 'AGENT', agentId: p.agentId ?? undefined, acceptedBy: p.acceptedBy ?? undefined };
      }
    }
    const r = await commitArtifact(prisma, pack, { productId, type, content, committedBy: persona.id, message: message || `Edited ${type}`, provenance });
    return { ok: true, message: r.unchanged ? 'No changes to commit.' : `Committed v${r.version}${r.staleGates.length ? ` — gate ${r.staleGates.join(', ')} is now STALE and needs re-approval` : ''}.` };
  });
}

export async function runAgent(packId: string, productId: string, stage: number): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, rubrics, persona, prisma } = await ctx(packId);
    const r = await runLifecycleAgent(prisma, pack, rubrics, { productId, stage, trigger: 'MANUAL', requestedBy: persona.id, qs: await qsOrUndefined(packId) });
    return { ok: true, message: r.narrative };
  });
}

export async function decideField(packId: string, productId: string, proposalId: string, outcome: 'ACCEPT' | 'EDIT' | 'REJECT', editedValue?: unknown): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, persona, prisma } = await ctx(packId);
    const r = await decideProposal(prisma, pack, { proposalId, personaId: persona.id, outcome, editedValue });
    return { ok: true, message: r.state.toLowerCase() };
  });
}

export async function acceptAllFields(packId: string, productId: string, stage: number): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, persona, prisma } = await ctx(packId);
    const r = await acceptAll(prisma, pack, productId, stage, persona.id);
    return { ok: true, message: `Accepted ${r.accepted}${r.skippedSensitive ? `; ${r.skippedSensitive} sensitive field(s) need one-by-one review` : ''}.` };
  });
}

export async function submitStage(packId: string, productId: string, stage: number): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, rubrics, persona, prisma } = await ctx(packId);
    await submitForReview(prisma, pack, rubrics, productId, stage, persona.id, { qs: await qsOrUndefined(packId) });
    return { ok: true, message: `Stage ${stage} submitted for gate review.` };
  });
}

export async function decideGate(packId: string, productId: string, gateId: string, outcome: 'APPROVE' | 'REJECT' | 'VETO', rationale: string): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, persona, prisma } = await ctx(packId);
    const r = await recordDecision(prisma, pack, { subjectType: 'GATE', subjectId: gateId, actor: { kind: 'HUMAN', personaId: persona.id }, outcome, rationale: rationale.trim() || `${outcome.toLowerCase()} by ${persona.name}` });
    return { ok: true, message: `Gate is now ${r.state.replace('_', ' ').toLowerCase()}.` };
  });
}

export async function applyCertFix(packId: string, productId: string, fixId: string): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, rubrics, persona, prisma } = await ctx(packId);
    const checks = await applyFix(prisma, pack, rubrics, productId, fixId, persona.id, { qs: await qsOrUndefined(packId) });
    await refreshScorecard(packId, productId, persona.id, checks);
    return { ok: true, message: `${fixId} applied; checks re-evaluated.` };
  });
}

export async function evaluateChecks(packId: string, productId: string): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, rubrics, persona, prisma } = await ctx(packId);
    const checks = await evaluateAndStoreChecks(prisma, pack, rubrics, productId, { qs: await qsOrUndefined(packId) });
    await refreshScorecard(packId, productId, persona.id, checks);
    return { ok: true, message: `${checks.filter((c) => c.status === 'pass').length}/8 checks pass.` };
  });
}

async function refreshScorecard(packId: string, productId: string, personaId: string, checks: { label: string; status: string; detail: string }[]) {
  const pack = getPack(packId);
  const prisma = db();
  const prev = (await latestVersions(prisma, productId)).get('certification-scorecard')?.content ?? {};
  await commitArtifact(prisma, pack, { productId, type: 'certification-scorecard', content: { datsis: [], ...prev, checks: checks.map((c) => ({ check: c.label, status: c.status, detail: c.detail })) }, committedBy: personaId, message: 'Certification checks re-evaluated' });
}

/** Stage 3/8 tools: run real profiling or the DQ rules now (evidence for the agent and criteria). */
export async function runQualityNow(packId: string, productId: string): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, rubrics, prisma } = await ctx(packId);
    const qs = await governedService(packId);
    const row = await prisma.dataProduct.findUnique({ where: { id: productId } });
    if (!row) throw new LifecycleError('Unknown product');
    const q = await runProductQuality(pack, rubrics, qs, productModel(pack, row));
    if (q.results.length) {
      await prisma.qualityRuleResult.createMany({ data: q.results.map((r) => ({ productId, ruleId: r.ruleId, dimension: r.dimension, passed: r.passed, observed: r.observed, threshold: r.threshold })) });
      await prisma.qualityScoreSnapshot.create({ data: { productId, score: q.score, dimensionsJson: JSON.stringify(q.dimensions), rubricVersion: rubrics.version } });
    }
    return { ok: true, message: `${q.results.length} rules run; score ${q.score}.` };
  });
}

export async function runProfilingNow(packId: string, productId: string): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, prisma } = await ctx(packId);
    const row = await prisma.dataProduct.findUnique({ where: { id: productId } });
    if (!row) throw new LifecycleError('Unknown product');
    const p = await profileProduct(pack, await governedService(packId), productModel(pack, row));
    return { ok: true, message: `Profiled ${p.length} object(s).`, details: p.map(profileSummary).map((s) => `${s.object}: ${s.rows} rows, ${s.columns} columns, worst null ${s.worstNullPct}%`) };
  });
}

export async function autopilot(packId: string, productId: string, op: 'start' | 'step' | 'cancel'): Promise<ActionResult> {
  return wrap(packId, productId, async () => {
    const { pack, rubrics, persona, prisma } = await ctx(packId);
    const runId = await startAutopilot(prisma, productId, persona.id);
    if (op === 'cancel') {
      await cancelAutopilot(prisma, runId);
      return { ok: true, message: 'Autopilot cancelled.' };
    }
    if (op === 'start') return { ok: true, message: 'Autopilot started.' };
    const r = await stepAutopilot(prisma, pack, rubrics, runId, await qsOrUndefined(packId));
    return { ok: true, message: r.step.text };
  });
}
