import { describe, it } from 'vitest';

// CLAUDE.md §4.8 — Determinism. Implemented in Phase 1 (warehouse) and Phase 3 (golden answers).
describe('I08 determinism', () => {
  it.todo('two builds of the same pack + seed + scale produce identical per-table checksums');
  it.todo('no Math.random / Date.now / argument-less new Date() in src/lib/{warehouse,query,agents/scripted,strategy} (eslint + source scan)');
  it.todo('scripted answers for every golden scenario are byte-identical across runs');
});
