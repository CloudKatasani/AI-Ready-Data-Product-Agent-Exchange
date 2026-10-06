# ADR-0019 — Incident overlays at query time; calibrated agent-quality score

Status: Accepted (Phase 7)

## Context
05 §2 step 4 describes incident effects as overlay views in a `_INCIDENT` schema, created and dropped on
Break and Resolve. 01 §M10 also asks the Agent Quality fix to move "the agent's eval by the
pack-declared delta" (88% → 94%).

## Decision
1. **Overlays are query-time subqueries, not DDL.**
   - While an incident is open, `QueryService` wraps the base object in an overlay subquery. Masking
     and row access then apply over the overlay. The overlay code is in `src/lib/query/incidents.ts`.
   - The effect depends on the incident kind:

     | Kind | Overlay effect |
     |---|---|
     | `late_feed` | rows newer than max − lag are hidden |
     | `null_spike` | `hash(key) % 100 < pct` → NULL |
     | `duplicate_load` | a hashed share of rows is unioned again |
     | `schema_drift` | `* RENAME`; a metric that references the column raises `IncidentBlocked` before execution |
     | `volume_anomaly` | the last N days are dropped |

   - This keeps the same goal as 05: the same compiled SQL sees incident data, through the one governed
     path. Nothing is written to the warehouse, and the effects are deterministic.
   - Reset (I09) stays a pure snapshot copy, and the warehouse file stays read-only.
   - The open incidents reach `PolicyState.incidents` from the `Incident` table.
   - Products touched by an open incident report `health: degraded` (or `down` for SEV1 schema drift).
     Answers then carry an `incident` banner and drop to Questionable.
2. **Quality score**:
   - Agents without a pack-scripted fix show the measured harness score (`evaluateAgent` overall).
   - The pack's quality-fix agent shows the pack-calibrated before and after numbers. The "after" value
     appears only once the fix actually changes the answer, which is checked by re-asking the
     feedback question and confirming it resolves to the fix's metric.
   - The fix itself is real: a versioned `KnowledgeOverlay` that `livePack()` merges, so Ask, eval and
     the Marketplace all see it.
   - Before and after values are stored in `QualityFixRun`.

## Consequences
- Break and Resolve are instant, and they also re-run the affected products' DQ rules. Those rules go
  through the same overlay, so a null spike genuinely fails its completeness rule.
- The 88 → 94 values are labelled as calibrated in the UI. The measured harness score is shown beside them.
