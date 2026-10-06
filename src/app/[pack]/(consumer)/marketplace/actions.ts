'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { AccessError, evaluateAccess, type PolicyPreview, submitAccessRequest } from '@/lib/marketplace/access';
import { duplicateCandidates, type DuplicateCandidate, submitDemand, voteDemand } from '@/lib/marketplace/demand';
import { getPack, getRubrics, hasPack } from '@/lib/packs/registry';
import { catalogState } from '@/lib/presenter/marketplace';
import { activePersona, activePrincipal } from '../../_server/session';

/** Policy preview for the request drawer (06 §6). Persona comes from the signed cookie. */
export async function previewAccess(packId: string, productId: string, purpose: string): Promise<PolicyPreview | null> {
  if (!hasPack(packId)) return null;
  const pack = getPack(packId);
  if (!pack.products.some((p) => p.id === productId)) return null;
  const who = await activePrincipal(pack);
  const state = await catalogState(pack, who.personaId);
  return evaluateAccess(pack, getRubrics(), productId, who, purpose, state.live.get(productId));
}

export interface RequestResult {
  ok: boolean;
  state?: string;
  error?: string;
}

export async function requestAccess(packId: string, input: { productId: string; purpose: string; justification: string; durationDays: number }): Promise<RequestResult> {
  if (!hasPack(packId)) return { ok: false, error: 'Unknown pack' };
  const pack = getPack(packId);
  const who = await activePrincipal(pack);
  const state = await catalogState(pack, who.personaId);
  try {
    const r = await submitAccessRequest(db(), pack, getRubrics(), who, input, state.live.get(input.productId));
    revalidatePath(`/${packId}`, 'layout');
    return { ok: true, state: r.state };
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function vote(packId: string, demandId: string): Promise<void> {
  if (!hasPack(packId)) return;
  const persona = await activePersona(getPack(packId));
  await voteDemand(db(), packId, demandId, persona.id);
  revalidatePath(`/${packId}/marketplace`);
}

export interface DemandSubmitResult {
  ok: boolean;
  duplicates?: DuplicateCandidate[];
  id?: string;
  error?: string;
}

/** First call returns duplicate candidates; `force` submits regardless. */
export async function submitNeed(packId: string, input: { kind: 'PRODUCT' | 'AGENT'; title: string; description: string; force?: boolean }): Promise<DemandSubmitResult> {
  if (!hasPack(packId)) return { ok: false, error: 'Unknown pack' };
  if (input.title.trim().length < 4 || input.description.trim().length < 10) return { ok: false, error: 'Add a title and a short description.' };
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  if (!input.force) {
    const open = await db().demandItem.findMany({ where: { packId }, select: { id: true, title: true, description: true } });
    const dups = duplicateCandidates(pack, getRubrics(), `${input.title} ${input.description}`, open);
    if (dups.length) return { ok: false, duplicates: dups };
  }
  const r = await submitDemand(db(), pack, persona.id, input);
  revalidatePath(`/${packId}/marketplace`);
  return { ok: true, id: r.id };
}
