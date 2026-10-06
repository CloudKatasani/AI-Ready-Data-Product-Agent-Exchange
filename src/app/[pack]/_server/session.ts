import { cookies } from 'next/headers';
import { getEnv } from '@/lib/config/env';
import type { Pack, Persona } from '@/lib/packs/schema';
import { principalForPersona } from '@/lib/presenter/governed';
import { PERSONA_COOKIE, resolvePersona, verifyPersona } from '@/lib/presenter/session';
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
