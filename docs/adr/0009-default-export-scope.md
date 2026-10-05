# ADR-0009 — Scope of "no default exports except Next pages"

- Status: Accepted (Phase 0)
- Raised as a conflict per CLAUDE.md preamble.

## Context
CLAUDE.md §8 says "no default exports except Next pages". Next.js also *requires* default exports
from other App Router convention files (`layout`, `not-found`, `error`, `loading`, `template`,
`default`) and from tool config files (`next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`,
`vitest.config.ts`, `playwright.config.ts`). Read literally, the rule cannot be satisfied.

## Decision
Interpret "Next pages" as **Next.js App Router convention files**. Inside `src/`, default exports are
lint-forbidden everywhere except `src/app/**/{page,layout,template,loading,error,global-error,not-found,default}.tsx`
(`no-restricted-syntax` in `eslint.config.mjs`). Root-level tool configs are outside `src/` and may
default-export because their tools require it.

## Consequences
The intent (named exports for all application code) is enforced; the framework still works. If the
owner wants a stricter reading, only the ESLint file list changes.
