'use server';

import { cookies } from 'next/headers';
import { getEnv } from '@/lib/config/env';
import { getPack, hasPack } from '@/lib/packs/registry';
import { PERSONA_COOKIE, signPersona } from '@/lib/presenter/session';

export interface PersonaSwitchResult {
  ok: boolean;
  name?: string;
  sees?: string;
}

/** Switches the demo persona (signed, httpOnly cookie). The policy engine still enforces everything server-side. */
export async function switchPersona(packId: string, personaId: string): Promise<PersonaSwitchResult> {
  if (!hasPack(packId)) return { ok: false };
  const persona = getPack(packId).personas.find((p) => p.id === personaId);
  if (!persona) return { ok: false };
  const jar = await cookies();
  jar.set(PERSONA_COOKIE, signPersona(persona.id, getEnv().SESSION_SECRET), { httpOnly: true, sameSite: 'lax', path: '/' });
  return { ok: true, name: persona.name, sees: persona.sees };
}
