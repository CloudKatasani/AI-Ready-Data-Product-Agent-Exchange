'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getEnv } from '@/lib/config/env';
import { getPack, hasPack } from '@/lib/packs/registry';
import { checkpoint, resetDemo, ResetError } from '@/lib/presenter/reset';
import { PERSONA_COOKIE, signPersona } from '@/lib/presenter/session';
import { resolveStory } from '@/lib/presenter/stories';
import { activeProfile } from './_server/session';

export interface PresenterResult {
  ok: boolean;
  message: string;
  href?: string;
}

async function setPersona(personaId: string) {
  (await cookies()).set(PERSONA_COOKIE, signPersona(personaId, getEnv().SESSION_SECRET), { httpOnly: true, sameSite: 'lax', path: '/' });
}

/** Story step "Go": persona, checkpoint (restore or take), then the URL that shows the documented state. */
export async function goStepAction(packId: string, storyId: string, stepId: string): Promise<PresenterResult> {
  if (!hasPack(packId)) return { ok: false, message: 'Unknown pack' };
  const pack = getPack(packId);
  const step = resolveStory(pack, storyId)?.steps.find((s) => s.id === stepId);
  if (!step) return { ok: false, message: 'Unknown step' };
  let note = '';
  const profile = await activeProfile(pack);
  if (step.checkpoint && profile) {
    try {
      note = (await checkpoint(profile.id, storyId, stepId)) === 'restored' ? ' (checkpoint restored)' : ' (checkpoint saved)';
    } catch (e) {
      note = e instanceof ResetError ? ` (${e.message})` : '';
    }
  }
  await setPersona(step.personaId);
  revalidatePath(`/${packId}`, 'layout');
  return { ok: true, message: `${step.title}${note}`, href: step.href };
}

/** Reset demo (AC1.4): restore the active profile's starting snapshot; the profile and branding stay. */
export async function resetDemoAction(packId: string): Promise<PresenterResult> {
  if (!hasPack(packId)) return { ok: false, message: 'Unknown pack' };
  const pack = getPack(packId);
  const profile = await activeProfile(pack);
  if (!profile) return { ok: false, message: 'Launch a Demo Profile first — reset restores its starting state.' };
  try {
    const r = await resetDemo(profile.id);
    const first = profile.storyId ? resolveStory(pack, profile.storyId)?.steps[0] : undefined;
    if (first) await setPersona(first.personaId);
    revalidatePath(`/${packId}`, 'layout');
    return { ok: true, message: `Demo reset in ${r.ms} ms.`, href: first?.href ?? `/${packId}/home` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Reset failed.' };
  }
}
