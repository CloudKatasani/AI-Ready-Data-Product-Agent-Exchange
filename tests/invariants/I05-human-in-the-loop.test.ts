import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { decideProposal, runLifecycleAgent } from '@/lib/lifecycle/agent-runs';
import { exitCriteria } from '@/lib/lifecycle/criteria';
import { LifecycleError, latestVersions, submitForReview } from '@/lib/lifecycle/engine';
import { submitIntake, triageApprove } from '@/lib/lifecycle/intake';
import { pack, rubrics } from '../setup/query';

const id = (a: string) => pack.personas.find((p) => p.archetype === a)?.id ?? '';

// CLAUDE.md §4.5 — agent output is persisted as AgentProposal rows with field-level provenance; a stage
// cannot be submitted while any field is unreviewed agent output.
describe('I05 human-in-the-loop', () => {
  it('exit criteria fail whenever an open proposal exists (pure)', () => {
    for (let stage = 1; stage <= 11; stage++) {
      const c = exitCriteria(stage, rubrics, { contents: {}, openProposals: 1, qualityScore: 100, semanticErrors: [], checks: [], profileTargets: [] });
      expect(c.find((x) => x.id === 'no_unreviewed_agent_fields')?.ok).toBe(false);
    }
  });

  it('agent output lands as proposals only; submit is refused until each is decided; rejected values never enter an artifact', async () => {
    const prisma = db();
    const req = await submitIntake(prisma, pack, rubrics, id('B'), { title: 'Feeder load headroom', decision: 'Which feeders need reinforcement before winter peak', decider: 'Planning director', cadence: 'Quarterly', workaround: 'Spreadsheet of SCADA peaks', questions: ['Which feeders peaked above 90%?', 'How fast is peak growing?', 'Where is headroom lowest?'], stakes: 'Overloads', freshness: 'Daily' });
    const { productId } = await triageApprove(prisma, pack, req.id, id('C'), 'Owner assigned');
    await prisma.artifactVersion.count();
    // Blank out a field so the Discovery agent has something to propose.
    const reg = (await latestVersions(prisma, productId)).get('decision-register');
    expect(reg).toBeDefined();
    const { commitArtifact } = await import('@/lib/lifecycle/engine');
    await commitArtifact(prisma, pack, { productId, type: 'decision-register', content: { ...(reg?.content ?? {}), cadence: '' }, committedBy: id('C'), message: 'clear cadence' });
    const run = await runLifecycleAgent(prisma, pack, rubrics, { productId, stage: 1, trigger: 'MANUAL', requestedBy: id('C') });
    const open = await prisma.agentProposal.findMany({ where: { productId, state: 'OPEN' } });
    expect(run.proposals).toBe(open.length);
    if (open.length) {
      await expect(submitForReview(prisma, pack, rubrics, productId, 1, id('C'))).rejects.toThrow(LifecycleError);
      const rejected = open[0];
      if (!rejected) throw new Error('proposal');
      await decideProposal(prisma, pack, { proposalId: rejected.id, personaId: id('C'), outcome: 'REJECT' });
      const after = (await latestVersions(prisma, productId)).get('decision-register');
      expect(after?.content[rejected.fieldPath]).not.toEqual(JSON.parse(rejected.proposedJson));
    }
  });
});
