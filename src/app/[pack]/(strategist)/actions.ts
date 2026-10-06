'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionResult } from '@/components/lifecycle/use-action';
import { getPack, hasPack } from '@/lib/packs/registry';
import { overridePriority, saveAssessment } from '@/lib/presenter/strategy';
import { QUESTIONS } from '@/lib/strategy/readiness';
import { activePersona } from '../_server/session';

async function persona(packId: string) {
  if (!hasPack(packId)) throw new Error('Unknown pack');
  return activePersona(getPack(packId));
}

/** Saves the answers currently on the readiness form as a named assessment. */
export async function saveAssessmentAction(packId: string, form: FormData): Promise<void> {
  const answers: Record<string, number> = {};
  for (const q of QUESTIONS) {
    const v = Number(form.get(q.id));
    if (Number.isInteger(v) && v >= 1 && v <= 5) answers[q.id] = v;
  }
  const id = await saveAssessment(packId, String(form.get('name') ?? ''), answers, (await persona(packId)).id);
  revalidatePath(`/${packId}/readiness`);
  redirect(`/${packId}/readiness?saved=${id}&${QUESTIONS.filter((q) => answers[q.id]).map((q) => `${q.id}=${answers[q.id]}`).join('&')}`);
}

export async function overrideAction(packId: string, productId: string, model: 'WSJF' | 'RICE', input: { score: string; reason: string }): Promise<ActionResult> {
  try {
    await overridePriority(packId, productId, model, Number(input.score), input.reason, (await persona(packId)).id);
    revalidatePath(`/${packId}/portfolio`);
    return { ok: true, message: 'Override recorded with its reason.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'The override could not be recorded.' };
  }
}
