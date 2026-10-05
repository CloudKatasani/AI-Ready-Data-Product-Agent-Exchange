# ADR-0003 — Declarative industry packs (YAML + SQL + Markdown), no TypeScript per pack

- Status: Accepted (Phase 0; implemented Phase 1)
- Source: `02-architecture.md` §2, `04-industry-packs.md`

## Context
AI-Ready shipped per-pack TypeScript row generators; adding an industry meant writing code.

## Decision
A pack is content only: YAML, SQL and Markdown under `packs/<packId>/`, validated by Zod schemas in
`src/lib/packs/schema.ts` (JSON Schema emitted to `packs/_schema/`). Engines are generic. No industry,
company, KPI or column name may appear in `src/` (invariant I01, `scripts/lint/no-domain-strings.ts`).

## Consequences
- New industries are content work; the validator can check everything (≥ 500 checks per deep pack).
- An LLM Pack Drafter (M13) can author packs constrained by the same schema.
