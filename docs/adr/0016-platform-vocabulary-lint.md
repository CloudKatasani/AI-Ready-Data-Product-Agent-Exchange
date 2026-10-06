# ADR-0016 — Platform vocabulary is exempt from the domain-string lint

Status: Accepted (Phase 4)

## Context
Invariant I01 forbids industry terms in `src/`. The lint's term list includes every pack source and
object name. The utilities pack has a `CONTRACT` source table (procurement contracts). That turned
"contract" into a banned word. But "data contract" is Keystone's own vocabulary: the Contract tab
(01 §M3), the ODCS export (06 §8) and `src/lib/standards/odcs.ts`.

## Decision
`lintTerms()` drops a short, explicit list of platform vocabulary (`PLATFORM_VOCABULARY` in
`src/lib/packs/validate/policy-checks.ts`), currently `contract` and `contracts`. Adding a word to that
list requires an ADR amendment.

## Consequences
Industry-specific compounds ("spend under contract", the `CONTRACT` table's columns) still come only
from packs. The generic word can name the platform's data-contract features.
