import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signed cookie values (ADR-0006): `<value>.<base64url HMAC-SHA256>`. */
const mac = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function signValue(value: string, secret: string): string {
  return `${value}.${mac(value, secret)}`;
}

/** Returns the value if the signature is valid, else null (tampered or foreign cookies are ignored). */
export function verifyValue(cookie: string | undefined, secret: string): string | null {
  if (!cookie) return null;
  const i = cookie.lastIndexOf('.');
  if (i <= 0) return null;
  const value = cookie.slice(0, i);
  const sig = Buffer.from(cookie.slice(i + 1));
  const expected = Buffer.from(mac(value, secret));
  return sig.length === expected.length && timingSafeEqual(sig, expected) ? value : null;
}

/** Signed active-profile cookie name; read by the app DB router (one database per Demo Profile, ADR-0024). */
export const PROFILE_COOKIE = 'ks_profile';
