# ADR-0024: One app database per Demo Profile (shared server)

Status: Accepted (post-Phase 11). This deviates from `12-deployment.md` §4; the user chose the deviation.

## Context
`12-deployment.md` §4 and `11-build-plan.md` (Phase 9, then Phase 11) ask for several presenters to share one server without collisions. The spec's mechanism is a `profileId` column on every mutable table, plus per-profile incident schemas.

That would touch about 38 Prisma models and every engine query. The append-only invariants (I06) and snapshot reset (ADR-0021) would both need profile-aware rewrites. Incidents are already query-time overlays built from app-DB rows (ADR-0019), so they need no warehouse schema.

## Decision
1. **Control DB.** The `DATABASE_URL` database holds the Demo Profiles. It is also the demo state used when no profile is active.
2. **One SQLite database per profile.** Each profile gets `<control>-profiles/<profileId>.db`, next to the control DB on the same volume.
   - It is created on save by `VACUUM INTO` from the control DB, and snapshotted as the profile's starting point.
   - `launchAction` recreates it when it is missing or older than the control DB's latest migration (after an upgrade).
   - Archiving a profile deletes its DB, snapshot and checkpoints.
3. **Routing.** `db()` returns a router. Each call runs on the active profile's DB when it executes:
   - the profile is taken from the explicit `withProfileDb(id, fn)` scope (captured when the call is created), or else from the request's signed profile cookie;
   - otherwise the call runs on the control DB.

   Engines keep calling `db()` unchanged. Array `$transaction`s are rebuilt on the chosen client, and interactive transactions and raw SQL are routed the same way. `controlDb()` is used explicitly for profile rows.
4. **Scope.** Reset and checkpoints run inside the named profile's DB, so one presenter's reset never touches another's state.
5. **Postgres.** Per-profile DBs are SQLite only. On Postgres, profiles share the control DB, as in v1.

## Consequences
- **Full isolation without schema changes.** Gates, grants, answers, incidents, audit and query logs are separated per presenter. Covered by `tests/integration/profile-isolation.test.ts`.
- **Disk use.** One app DB per active profile, about 35 MB each on the seeded estate. Archive removes it.
- **Starting state.** A new profile starts from the control DB's current state, not the pristine seed.
- **Cross-profile reporting.** There is none, because the databases are separate files. A demo app does not need it.
