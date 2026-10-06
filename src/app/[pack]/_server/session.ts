import { cookies } from 'next/headers';
import { getEnv } from '@/lib/config/env';
import type { Pack, Persona } from '@/lib/packs/schema';
import { principalForPersona } from '@/lib/presenter/governed';
import { getProfile, type Profile } from '@/lib/presenter/profiles';
import { PERSONA_COOKIE, PROFILE_COOKIE, resolvePersona, verifyPersona, verifyProfile } from '@/lib/presenter/session';
import type { Principal } from '@/lib/query/types';

/** The active persona for this request (signed cookie; default analyst). */
export async function activePersona(pack: Pack): Promise<Persona> {
  const jar = await cookies();
  return resolvePersona(pack, verifyPersona(jar.get(PERSONA_COOKIE)?.value, getEnv().SESSION_SECRET));
}

export async function activePrincipal(pack: Pack): Promise<Principal> {
  const persona = await activePersona(pack);
  return principalForPersona(pack.manifest.id, persona.id);
}

/** The launched Demo Profile, when it belongs to this pack. */
export async function activeProfile(pack: Pack): Promise<Profile | null> {
  const jar = await cookies();
  const id = verifyProfile(jar.get(PROFILE_COOKIE)?.value, getEnv().SESSION_SECRET);
  const p = await getProfile(id);
  return p && p.packId === pack.manifest.id && !p.archived ? p : null;
}
