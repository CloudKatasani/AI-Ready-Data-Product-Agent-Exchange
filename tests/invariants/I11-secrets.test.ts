import { describe, it } from 'vitest';

// CLAUDE.md §4.11 — Secrets. Implemented in Phase 2.
describe('I11 secrets', () => {
  it.todo('ANTHROPIC_API_KEY is read from process.env only (source scan: no other reader)');
  it.todo('the API key never appears in rendered HTML, client bundles, logs, DB rows or pack files (planted-key scan)');
  it.todo('the admin screen exposes key presence only, never the value');
  it.todo('production start refuses the default SESSION_SECRET');
});
