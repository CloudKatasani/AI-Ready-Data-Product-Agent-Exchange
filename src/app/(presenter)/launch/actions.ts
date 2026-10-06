'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/config/env';
import { getPack, hasPack } from '@/lib/packs/registry';
import { archiveProfile, createProfile, duplicateProfile, ensureProfileState, getProfile, importProfile, markUsed, ProfileError } from '@/lib/presenter/profiles';
import { defaultPersona, PERSONA_COOKIE, PROFILE_COOKIE, signPersona, signProfile } from '@/lib/presenter/session';
import { resolveStory } from '@/lib/presenter/stories';

export interface SaveResult {
  ok: boolean;
  message: string;
  suggestions?: { field: string; colour: string; suggestion: string }[];
}

const MAX_LOGO = 200 * 1024;

async function logoDataUrl(file: FormDataEntryValue | null): Promise<string | undefined> {
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_LOGO) throw new ProfileError('Logo must be 200 KB or smaller');
  if (file.type !== 'image/png' && file.type !== 'image/svg+xml') throw new ProfileError('Logo must be a PNG or SVG');
  return `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
}

/** Profile setup drawer submit (useActionState). */
export async function saveProfileAction(_prev: SaveResult | null, form: FormData): Promise<SaveResult> {
  try {
    const packId = String(form.get('packId') ?? '');
    const terms: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      if (k.startsWith('term:') && typeof v === 'string' && v.trim()) terms[k.slice(5)] = v.trim();
    }
    const logo = await logoDataUrl(form.get('logo'));
    const p = await createProfile({
      name: String(form.get('name') ?? ''),
      packId,
      brand: { productName: String(form.get('productName') ?? ''), companyName: String(form.get('companyName') ?? ''), primary: String(form.get('primary') ?? ''), accent: String(form.get('accent') ?? ''), ...(logo ? { logoDataUrl: logo } : {}) },
      terms,
      storyId: String(form.get('storyId') ?? '') || null,
      agentMode: String(form.get('agentMode') ?? 'scripted'),
      locked: form.get('locked') === 'on',
    });
    revalidatePath('/launch');
    return { ok: true, message: `Saved “${p.name}”.` };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message, suggestions: e.suggestions };
    return { ok: false, message: e instanceof Error ? e.message : 'The profile could not be saved.' };
  }
}

/** Launch (AC1.1): profile + story-start persona cookies, then the pack's Home. */
export async function launchAction(profileId: string): Promise<void> {
  const p = await getProfile(profileId);
  if (!p || p.archived || !hasPack(p.packId)) redirect('/launch');
  // The profile's own app DB (ADR-0024): recreated if missing or older than the control DB's migrations.
  await ensureProfileState(p.id);
  const pack = getPack(p.packId);
  const first = p.storyId ? resolveStory(pack, p.storyId)?.steps[0] : undefined;
  const persona = first?.personaId ?? defaultPersona(pack).id;
  const jar = await cookies();
  const secret = getEnv().SESSION_SECRET;
  jar.set(PROFILE_COOKIE, signProfile(p.id, secret), { httpOnly: true, sameSite: 'lax', path: '/' });
  jar.set(PERSONA_COOKIE, signPersona(persona, secret), { httpOnly: true, sameSite: 'lax', path: '/' });
  await markUsed(p.id);
  redirect(`/${p.packId}/home`);
}

export async function archiveAction(profileId: string): Promise<void> {
  await archiveProfile(profileId);
  revalidatePath('/launch');
}

export async function duplicateAction(profileId: string): Promise<void> {
  await duplicateProfile(profileId);
  revalidatePath('/launch');
}

export async function importAction(_prev: SaveResult | null, form: FormData): Promise<SaveResult> {
  const f = form.get('file');
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: 'Choose a profile file.' };
  if (f.size > 1024 * 1024) return { ok: false, message: 'Profile file is too large.' };
  try {
    const p = await importProfile(await f.text());
    revalidatePath('/launch');
    return { ok: true, message: `Imported “${p.name}”.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Import failed.' };
  }
}
