import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertStartupConfig, parseEnv } from '@/lib/config/env';

// CLAUDE.md §4.11 — ANTHROPIC_API_KEY from env only; never logged, sent to the browser or persisted.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const src = files(join(process.cwd(), 'src'));

describe('I11 secrets', () => {
  it('ANTHROPIC_API_KEY is read in exactly one module (src/lib/config/env.ts)', () => {
    const readers = src.filter((f) => readFileSync(f, 'utf8').includes('ANTHROPIC_API_KEY')).map((f) => relative(process.cwd(), f));
    expect(readers).toEqual(['src/lib/config/env.ts']);
  });

  it('no client component imports the server config module', () => {
    const clients = src.filter((f) => /^['"]use client['"]/.test(readFileSync(f, 'utf8').trimStart()));
    const leaks = clients.filter((f) => /@\/lib\/config\/env/.test(readFileSync(f, 'utf8'))).map((f) => relative(process.cwd(), f));
    expect(leaks).toEqual([]);
  });

  it('nothing logs process.env wholesale', () => {
    const offenders = src.filter((f) => /console\.\w+\([^)]*process\.env\b(?!\.)/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('production start refuses the default SESSION_SECRET', () => {
    expect(() => assertStartupConfig(parseEnv({ NODE_ENV: 'production' }))).toThrow(/SESSION_SECRET/);
  });

  it.todo('the admin screen exposes key presence only (Phase 6 Admin)');
});
