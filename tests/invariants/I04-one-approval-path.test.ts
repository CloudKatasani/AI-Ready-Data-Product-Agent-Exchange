import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}
const SRC = files(join(process.cwd(), 'src')).map((f) => ({ file: relative(process.cwd(), f), text: readFileSync(f, 'utf8') }));
const DECISIONS = 'src/lib/lifecycle/decisions.ts';

// CLAUDE.md §4.4 — One approval path. Access requests in Phase 4; gates, certification and publish in Phase 5.
describe('I04 one approval path', () => {
  it('only recordDecision() writes Decision rows', () => {
    const writers = SRC.filter((f) => /\.decision\.(create|createMany|update|upsert)\(/.test(f.text)).map((f) => f.file);
    expect(writers).toEqual([DECISIONS]);
  });

  it('recordDecision() is the only code path that sets AccessRequest.status = GRANTED or grants an entitlement by request', () => {
    // Assignments only (`state = 'GRANTED'`, `state: 'GRANTED'`), not comparisons (`=== 'GRANTED'`).
    const granted = SRC.filter((f) => /state(:|\s*=(?!=))\s*['"]GRANTED['"]/.test(f.text)).map((f) => f.file);
    expect(granted).toEqual([DECISIONS]);
    const requestGrants = SRC.filter((f) => /grantedVia:\s*['"]REQUEST['"]/.test(f.text)).map((f) => f.file);
    expect(requestGrants).toEqual([DECISIONS]);
    const updates = SRC.filter((f) => /accessRequest\.(update|updateMany|upsert)\(/.test(f.text)).map((f) => f.file);
    expect(updates).toEqual([DECISIONS]);
  });

  it('recordDecision() rejects an agent actor (behaviour covered in tests/integration/access.test.ts)', () => {
    const src = SRC.find((f) => f.file === DECISIONS)?.text ?? '';
    expect(src).toMatch(/actor\.kind === 'AGENT'\) throw new DecisionRefused/);
  });

  it.todo('recordDecision() is the only code path that sets Gate.status = APPROVED (source scan + behaviour)');
  it.todo('recordDecision() is the only code path that sets DataProduct/Agent status to CERTIFIED or PUBLISHED');
  it.todo('seeds reach approved states only via recordDecision() with a seeded human actor');
});
