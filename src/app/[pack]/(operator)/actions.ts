'use server';

import { revalidatePath } from 'next/cache';
import { copy } from '@/copy/en';
import type { ActionResult } from '@/components/lifecycle/use-action';
import { getPack, hasPack } from '@/lib/packs/registry';
import { IncidentError } from '@/lib/operate/incidents';
import { runEvaluation } from '@/lib/presenter/factory';
import { applyQualityFix, breakNow, dismissFeedback, resolveNow } from '@/lib/presenter/operate';
import { activePersona } from '../_server/session';

async function persona(packId: string) {
  if (!hasPack(packId)) throw new Error('Unknown pack');
  return activePersona(getPack(packId));
}

async function run(packId: string, paths: string[], fn: (personaId: string) => Promise<string>): Promise<ActionResult> {
  try {
    const message = await fn((await persona(packId)).id);
    for (const p of paths) revalidatePath(`/${packId}/${p}`, 'layout');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof IncidentError || e instanceof Error) return { ok: false, message: e.message };
    return { ok: false, message: 'The action could not be completed.' };
  }
}

export async function breakIncidentAction(packId: string, templateId: string): Promise<ActionResult> {
  return run(packId, ['health'], async (personaId) => {
    await breakNow(packId, templateId, personaId);
    const t = getPack(packId).incidents.find((x) => x.id === templateId);
    return `${templateId} opened — ${t?.affects.products.join(', ') ?? ''} degraded.`;
  });
}

export async function resolveIncidentAction(packId: string, incidentId: string): Promise<ActionResult> {
  return run(packId, ['health'], async (personaId) => {
    const pm = await resolveNow(packId, incidentId, personaId, new Date());
    return `${pm.templateId} resolved after ${pm.timeToResolveMinutes} ${copy.operate.health.minutes}.`;
  });
}

export async function applyFixAction(packId: string, agentId: string, feedbackId: string | null, custom: { term: string; metric: string } | null): Promise<ActionResult> {
  return run(packId, ['agent-quality'], async (personaId) => {
    const opts = custom ? { type: 'synonym' as const, payload: { term: custom.term.trim(), synonyms: [custom.term.trim()], maps_to: { kind: 'metric', ref: custom.metric } } } : {};
    const r = await applyQualityFix(packId, agentId, personaId, { ...(feedbackId ? { feedbackId } : {}), ...opts });
    return copy.operate.quality.fixed(r.evalBefore, r.evalAfter);
  });
}

export async function dismissFeedbackAction(packId: string, feedbackId: string): Promise<ActionResult> {
  return run(packId, ['agent-quality'], async () => {
    await dismissFeedback(feedbackId);
    return 'Dismissed.';
  });
}

export async function runEvalAction(packId: string, agentId: string): Promise<ActionResult> {
  return run(packId, ['agent-quality'], async () => {
    const r = await runEvaluation(packId, agentId);
    return `${agentId}: ${Math.round(r.overall * 1000) / 10}% overall, ${r.passed ? 'all suites pass' : 'a suite is below threshold'}.`;
  });
}
