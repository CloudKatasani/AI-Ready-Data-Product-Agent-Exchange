# ADR-0021 — Demo Profiles, in-place snapshot reset and story Go URLs

Status: Accepted (Phase 9)

## Context
ADR-0007 chose snapshot reset over re-seeding. Phase 9 needs four things:
- a reset under 3 s that keeps the profile and its branding (AC1.4);
- checkpoints per story step;
- a Go that lands every story step in its documented state (AC1.5);
- white-label profiles that persist (AC1.3).

Two story steps referenced predecessor features Keystone does not have: the tooling-specific Build Guide,
and a readiness "maturity tab" (maturity lives on Portfolio here).

## Decision
1. **Reset is an in-place table copy, not a file swap.**
   - `VACUUM INTO data/snapshots/<key>.db` takes a consistent snapshot.
   - Restore ATTACHes the snapshot and replaces every table except `DemoProfile` and
     `_prisma_migrations`, in one transaction with foreign keys off.
   - Restoring the utilities estate takes about 90 ms. No process restart or Prisma reconnect is
     needed, and the profile survives.
   - The warehouse is read-only at runtime (incident and knockout effects are query-time overlays,
     ADR-0019/0020), so it needs no restore.
   - SQLite now uses one pooled connection by default, because ATTACH and PRAGMA are per connection.
     SQLite serialises writes anyway.
   - Postgres reset is not supported in v1 (re-seed instead).
2. **Checkpoints**: snapshots keyed `<profile>__<story>-<step>`, taken the first time a checkpoint step is
   reached and restored on later visits. A reset clears them.
3. **Profiles** live in `DemoProfile` (persisted, archived rather than deleted).
   - Brand colours must pass WCAG AA (white or ink text). A failing colour gets a deterministic
     same-hue alternative, shown live and returned on save.
   - Terminology overrides are limited to the pack's `overridable` list and apply to displayed text
     only (a client-side text pass over `#main`; IDs, data and SQL are unchanged).
   - Export/import uses `.keystone-profile.json` with no secrets.
4. **Story Go**: `goHref()` maps each step's `go.route` and `state` to a concrete URL (product, stage,
   view, tab, preset, KPI, incident …). Pages honour those parameters, so Go is a server action that
   sets the persona, handles the checkpoint, then navigates.
5. **Story content**:
   - Step `p7` (Build Guide) is replaced by "The stack, layer by layer" on Platform Map.
   - Step `i6` goes to Portfolio's maturity view.
   - The coverage heatmap with "Simulate +4 weeks" is ported to Roadmap (per Bronze source, levels 0–6).
6. **Story PDF**: a printable cue-card page (`/[pack]/story/<id>`; print to PDF). Screenshot-per-step
   PDF generation is not built.
7. **Profile scoping of runtime models** (shared server, several presenters at once): done later, as one app DB per profile (ADR-0024).
   v1 runs one presenter per server.

## Consequences
- A reset restores the whole app DB to the profile's starting state, which is what a single-presenter
  demo needs. Concurrent presenters on one server would need the deferred profile scoping.
- Tests that reset use a private DB copy (`tests/setup/isolated-db.ts`). The Playwright `presenter`
  project runs after the others.
