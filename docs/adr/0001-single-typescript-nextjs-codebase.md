# ADR-0001 — Single TypeScript / Next.js codebase

- Status: Accepted (Phase 0)
- Source: `docs/build-spec/02-architecture.md` §2

## Context
The three predecessors split across a Vite SPA (no backend), a Next.js app, and a Next.js portal plus
Python FastAPI services. Keystone has to be one reliable demo artefact that a presenter runs on a laptop.

## Decision
One TypeScript (`strict`) codebase on Next.js 15 App Router: Server Components for pages, Server
Actions and Route Handlers (SSE for streaming) for services. **No Python.** Python logic from the
marketplace repo is translated to TypeScript faithfully with its test cases carried as fixtures.

## Consequences
- One deployable (`pnpm demo`, one Docker image), one test runner, one lint config.
- Services live in `src/lib/*` and never import React; UI reaches them only through Server Actions or
  Route Handlers. Module direction is lint-enforced (`eslint-plugin-boundaries`, `eslint.config.mjs`).
