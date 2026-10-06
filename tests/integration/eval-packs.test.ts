import { describe, expect, it } from 'vitest';
import { getPack, listPackIds } from '@/lib/packs/registry';
import { runEvaluation } from '@/lib/presenter/factory';

/** Phase 6 DoD: the scripted eval harness passes every production agent of every deep pack. */
const deep = listPackIds().filter((id) => {
  try {
    return getPack(id).manifest.depth === 'deep';
  } catch {
    return false;
  }
});

describe.each(deep)('eval harness — %s', (packId) => {
  const agents = getPack(packId).agents.filter((a) => a.status === 'PRODUCTION');
  it.each(agents.map((a) => [a.id] as const))('%s passes every suite threshold', async (agentId) => {
    const report = await runEvaluation(packId, agentId);
    const failing = Object.entries(report.suites).filter(([, s]) => !s.passed).map(([k, s]) => `${k} ${s.score}`);
    expect(failing).toEqual([]);
    expect(report.passed).toBe(true);
  }, 120_000);
});
