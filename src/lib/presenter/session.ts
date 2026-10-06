import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Pack, Persona } from '@/lib/packs/schema';

/** Signed persona cookie (ADR-0006): `<personaId>.<base64url HMAC-SHA256>`, httpOnly, sameSite=lax. */
export const PERSONA_COOKIE = 'ks_persona';

const mac = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function signPersona(personaId: string, secret: string): string {
  return `${personaId}.${mac(personaId, secret)}`;
}

/** Returns the persona id if the signature is valid, else null (tampered or foreign cookies are ignored). */
export function verifyPersona(cookie: string | undefined, secret: string): string | null {
  if (!cookie) return null;
  const i = cookie.lastIndexOf('.');
  if (i <= 0) return null;
  const id = cookie.slice(0, i);
  const sig = Buffer.from(cookie.slice(i + 1));
  const expected = Buffer.from(mac(id, secret));
  return sig.length === expected.length && timingSafeEqual(sig, expected) ? id : null;
}

/** The persona a pack starts with when no (valid) cookie is present: the analyst (archetype B). */
export function defaultPersona(pack: Pack): Persona {
  return pack.personas.find((p) => p.archetype === 'B') ?? (pack.personas[0] as Persona);
}

export function resolvePersona(pack: Pack, personaId: string | null): Persona {
  return pack.personas.find((p) => p.id === personaId) ?? defaultPersona(pack);
}

/** Signed active-profile cookie (same HMAC scheme as the persona cookie). */
export const PROFILE_COOKIE = 'ks_profile';
export const signProfile = signPersona;
export const verifyProfile = verifyPersona;
