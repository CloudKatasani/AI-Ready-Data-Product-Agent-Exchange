import type { Pack, Persona } from '@/lib/packs/schema';
import { PROFILE_COOKIE, signValue, verifyValue } from '@/lib/utils/signed';

/** Signed persona cookie (ADR-0006): `<personaId>.<base64url HMAC-SHA256>`, httpOnly, sameSite=lax. */
export const PERSONA_COOKIE = 'ks_persona';

export const signPersona = signValue;
/** Returns the persona id if the signature is valid, else null (tampered or foreign cookies are ignored). */
export const verifyPersona = verifyValue;

/** The persona a pack starts with when no (valid) cookie is present: the analyst (archetype B). */
export function defaultPersona(pack: Pack): Persona {
  return pack.personas.find((p) => p.archetype === 'B') ?? (pack.personas[0] as Persona);
}

export function resolvePersona(pack: Pack, personaId: string | null): Persona {
  return pack.personas.find((p) => p.id === personaId) ?? defaultPersona(pack);
}

/** Signed active-profile cookie (same HMAC scheme as the persona cookie). */
export { PROFILE_COOKIE };
export const signProfile = signValue;
export const verifyProfile = verifyValue;
