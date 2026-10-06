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
const writers = (re: RegExp) => SRC.filter((f) => re.test(f.text)).map((f) => f.file);

// CLAUDE.md §4.4 — One approval path: access requests, gates, triage and certification (agent publish: Phase 6).
describe('I04 one approval path', () => {
  it('only recordDecision() writes Decision rows', () => {
    expect(writers(/\.decision\.(create|createMany|update|upsert)\(/)).toEqual([DECISIONS]);
  });

  it('recordDecision() is the only code path that sets AccessRequest.status = GRANTED or grants an entitlement by request', () => {
    // Assignments only (`state = 'GRANTED'`, `state: 'GRANTED'`), not comparisons (`=== 'GRANTED'`).
    expect(writers(/state(:|\s*=(?!=))\s*['"]GRANTED['"]/)).toEqual([DECISIONS]);
    expect(writers(/grantedVia:\s*['"]REQUEST['"]/)).toEqual([DECISIONS]);
    expect(writers(/accessRequest\.(update|updateMany|upsert)\(/)).toEqual([DECISIONS]);
  });

  it('recordDecision() is the only code path that sets Gate.status = APPROVED (or decides a gate)', () => {
    // Writes of an APPROVED gate (create/update data), and the only caller of the pure evaluator.
    expect(writers(/\.gate\.(create|update|updateMany|upsert)\(\{[^;]*state:\s*outcome\.state|\.gate\.(create|update|updateMany|upsert)\(\{[^;]*state:\s*'APPROVED'/)).toEqual([DECISIONS]);
    expect(writers(/evaluateGateOutcome\(/).filter((f) => f !== 'src/lib/lifecycle/gates.ts')).toEqual([DECISIONS]);
    // Gate updates elsewhere may only submit (IN_REVIEW) or mark STALE.
    for (const f of SRC.filter((x) => x.file !== DECISIONS && /\.gate\.(update|updateMany)\(/.test(x.text))) {
      const states = [...f.text.matchAll(/\.gate\.update(?:Many)?\(\{[^)]*state:\s*'([A-Z_]+)'/g)].map((m) => m[1]);
      expect(states.every((s) => s === 'IN_REVIEW' || s === 'STALE'), `${f.file}: ${states.join(',')}`).toBe(true);
    }
  });

  it('recordDecision() is the only code path that sets a product CERTIFIED (or publishes a version)', () => {
    expect(writers(/status:\s*['"]CERTIFIED['"]|status:\s*statusForStage/)).toEqual([DECISIONS]);
    expect(writers(/publishedAt:\s*new Date/)).toEqual([DECISIONS]);
  });

  it('recordDecision() rejects an agent actor at every autonomy level, and autopilot/agents never call it', () => {
    const src = SRC.find((f) => f.file === DECISIONS)?.text ?? '';
    expect(src).toMatch(/actor\.kind === 'AGENT'\) throw new DecisionRefused/);
    for (const f of ['src/lib/lifecycle/autopilot.ts', 'src/lib/lifecycle/agent-runs.ts']) expect(SRC.find((x) => x.file === f)?.text).not.toMatch(/recordDecision\(/);
    expect(SRC.filter((f) => f.file.startsWith('src/lib/agents/')).some((f) => /recordDecision/.test(f.text))).toBe(false);
  });

  it('seeds reach approved states only via recordDecision() with a seeded human actor', () => {
    const seed = SRC.find((f) => f.file === 'src/lib/presenter/seed.ts')?.text ?? '';
    expect(seed).not.toMatch(/CERTIFIED|APPROVED|GRANTED/);
    const lifecycleSeed = SRC.find((f) => f.file === 'src/lib/lifecycle/seed.ts')?.text ?? '';
    expect(lifecycleSeed).toMatch(/recordDecision\(client, pack, \{ subjectType: 'GATE', subjectId: gate\.id, actor: \{ kind: 'HUMAN'/);
  });
});
