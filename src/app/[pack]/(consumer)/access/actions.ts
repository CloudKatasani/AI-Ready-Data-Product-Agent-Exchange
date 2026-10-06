'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { DecisionRefused, recordDecision } from '@/lib/lifecycle/decisions';
import { getPack, hasPack } from '@/lib/packs/registry';
import { activePersona } from '../../_server/session';

/** Approve or deny an access request as the active persona — through recordDecision() only (I04). */
export async function decideAccess(packId: string, requestId: string, outcome: 'APPROVE' | 'REJECT', rationale: string): Promise<{ ok: boolean; state?: string; error?: string }> {
  if (!hasPack(packId)) return { ok: false, error: 'Unknown pack' };
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  try {
    const r = await recordDecision(db(), pack, { subjectType: 'ACCESS_REQUEST', subjectId: requestId, actor: { kind: 'HUMAN', personaId: persona.id }, outcome, rationale: rationale.trim() || (outcome === 'APPROVE' ? 'Approved for the stated purpose.' : 'Denied.') });
    revalidatePath(`/${packId}`, 'layout');
    return { ok: true, state: r.state };
  } catch (e) {
    if (e instanceof DecisionRefused) return { ok: false, error: e.message };
    throw e;
  }
}
