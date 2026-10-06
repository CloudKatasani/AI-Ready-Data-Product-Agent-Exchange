'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { DecisionRefused } from '@/lib/lifecycle/decisions';
import { type IntakeInput, IntakeError, intakeDuplicates, submitIntake, triageApprove, triageDecline, triageMerge } from '@/lib/lifecycle/intake';
import type { DuplicateCandidate } from '@/lib/packs/similarity';
import { getPack, getRubrics, hasPack } from '@/lib/packs/registry';
import { activePersona } from '../../_server/session';

export async function checkDuplicates(packId: string, input: Pick<IntakeInput, 'title' | 'decision' | 'questions'>): Promise<DuplicateCandidate[]> {
  if (!hasPack(packId)) return [];
  return intakeDuplicates(getPack(packId), getRubrics(), input);
}

export async function submitRequest(packId: string, input: IntakeInput): Promise<{ ok: boolean; id?: string; reference?: string; duplicates?: DuplicateCandidate[]; error?: string }> {
  if (!hasPack(packId)) return { ok: false, error: 'Unknown pack' };
  const pack = getPack(packId);
  try {
    const r = await submitIntake(db(), pack, getRubrics(), (await activePersona(pack)).id, input);
    revalidatePath(`/${packId}/request`, 'layout');
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof IntakeError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function triage(packId: string, requestId: string, action: 'approve' | 'merge' | 'decline', arg: string): Promise<{ ok: boolean; message: string; productId?: string }> {
  if (!hasPack(packId)) return { ok: false, message: 'Unknown pack' };
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  try {
    let productId: string | undefined;
    if (action === 'approve') productId = (await triageApprove(db(), pack, requestId, persona.id, arg || 'Approved at triage')).productId;
    else if (action === 'merge') await triageMerge(db(), pack, requestId, persona.id, arg);
    else await triageDecline(db(), pack, requestId, persona.id, arg);
    revalidatePath(`/${packId}`, 'layout');
    return { ok: true, message: action === 'approve' ? `Created ${productId} at Stage 1.` : action === 'merge' ? `Merged into ${arg}.` : 'Declined.', productId };
  } catch (e) {
    if (e instanceof IntakeError || e instanceof DecisionRefused) return { ok: false, message: e.message };
    throw e;
  }
}
