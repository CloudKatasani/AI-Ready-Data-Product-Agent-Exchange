# ADR-0005 — Dual-mode agent runtime (scripted / live / auto)

- Status: Accepted (Phase 0; scripted Phase 3, live Phase 6)
- Source: `02-architecture.md` §2 and §5, `08-agents-llm.md`

## Decision
Agents run in three modes. **Scripted**: deterministic, offline, byte-reproducible (matcher + coverage
planner). **Live**: Anthropic Messages API tool-use loop over governed tools, ending in a structured
`submit_answer`, checked by the grounding validator. **Auto**: live, falling back to scripted on missing
key, timeout, budget or grounding failure — visibly (mode badge), never as an error screen.

## Consequences
- Scripted mode must work with no network and no API key at every phase.
- Model IDs are configuration (`KEYSTONE_MODEL_*` env vars), never literals in code.
