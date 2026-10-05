# ADR-0006 — Persona-based demo authentication

- Status: Accepted (Phase 0; implemented Phase 2)
- Source: `02-architecture.md` §2 and §7

## Decision
No passwords or SSO in v1 (`AUTH_MODE=demo`). The active persona is held in an HMAC-signed,
httpOnly, `sameSite=lax` cookie signed with `SESSION_SECRET`; the app refuses to start in production
with the default secret (enforced at startup in `src/instrumentation.ts`). Persona switching is the
demo gesture; the policy engine still enforces entitlements, masking and row access server-side.

## Consequences
- Personas are not security; the governance story is nevertheless real because enforcement is server-side.
- `AUTH_MODE=proxy` (trust a presenter header behind SSO) is a stretch for shared servers.
