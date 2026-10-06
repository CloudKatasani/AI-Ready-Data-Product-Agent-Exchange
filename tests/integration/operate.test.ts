import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { verifyChain } from '@/lib/db/audit';
import { getPack, getRubrics, listPackIds } from '@/lib/packs/registry';
import { computeCost, defaultLevers } from '@/lib/operate/cost';
import { impactOf } from '@/lib/operate/impact';
import { ask } from '@/lib/presenter/ask';
import { governedService } from '@/lib/presenter/governed';
import { applyQualityFix, breakNow, feedbackInbox, healthBoard, incidents, resolveNow } from '@/lib/presenter/operate';
import { principalFor } from '@/lib/query/principal';

const deep = listPackIds().filter((id) => {
  try {
    return getPack(id).manifest.depth === 'deep';
  } catch {
    return false;
  }
});

/** A covered question for the story incident's first affected agent, answered from an affected product. */
function incidentStory(packId: string) {
  const pack = getPack(packId);
  const t = pack.incidents.find((x) => x.id === pack.manifest.story_roles.incidentForStory);
  if (!t) throw new Error('no story incident');
  const views = new Set(pack.products.filter((p) => t.affects.products.includes(p.id)).map((p) => p.semantic_view));
  const scenario = pack.scenarios.find((s) => s.kind === 'answer' && t.affects.agents.includes(s.agent) && s.query && views.has(s.query.view));
  if (!scenario) throw new Error('no scenario on an affected product');
  const steward = pack.personas.find((p) => p.archetype === 'D');
  return { pack, t, scenario, personaId: steward?.id ?? '' };
}

describe.each(deep)('Run (operate) — %s', (packId) => {
  it('AC10.1 breaking the story incident turns the next answer to an incident banner and Questionable; resolving restores it', async () => {
    const { t, scenario, personaId } = incidentStory(packId);
    const q = { packId, personaId, question: scenario.question, agentId: scenario.agent };
    const before = (await ask(q)).answer;
    expect(before.kind).toBe('answer');
    expect(before.banners.some((b) => b.kind === 'incident')).toBe(false);

    const id = await breakNow(packId, t.id, personaId);
    const during = (await ask(q)).answer;
    if (t.kind === 'schema_drift') {
      expect(during.kind).toBe('decline');
    } else {
      expect(during.kind).toBe('answer');
      expect(during.confidence).toBe('questionable');
    }
    expect(during.banners.some((b) => b.kind === 'incident' && b.text.includes(t.id))).toBe(true);
    expect(during.result?.sources.some((s) => s.health !== 'healthy') ?? true).toBe(true);
    const board = await healthBoard(packId);
    for (const p of t.affects.products) expect(board.find((r) => r.productId === p)?.status).not.toBe('healthy');

    const pm = await resolveNow(packId, id, personaId, new Date(Date.now() + 25 * 60_000));
    expect(pm.timeToResolveMinutes).toBeGreaterThanOrEqual(25);
    const after = (await ask(q)).answer;
    expect(after.banners.some((b) => b.kind === 'incident')).toBe(false);
    expect(after.confidence).toBe(before.confidence);
    expect(after.headline).toBe(before.headline);
    expect((await incidents(packId)).find((i) => i.id === id)?.state).toBe('RESOLVED');
  }, 120_000);

  it('AC10.2 applying the scripted agent-quality fix raises the agent eval by the pack-declared delta', async () => {
    const pack = getPack(packId);
    const agent = pack.agents.find((a) => a.id === pack.manifest.story_roles.qualityFixAgent);
    const fix = agent?.quality_fix;
    if (!agent || !fix) throw new Error('no quality fix agent');
    const inbox = await feedbackInbox(packId);
    const fb = inbox.find((f) => f.agentId === agent.id && f.question === fix.feedback_question && f.state === 'NEW');
    expect(fb).toBeTruthy();
    const steward = pack.personas.find((p) => p.archetype === 'D')?.id ?? '';
    const r = await applyQualityFix(packId, agent.id, steward, { feedbackId: fb?.id });
    expect(r.evalBefore).toBe(fix.eval_before_pct);
    expect(r.evalAfter).toBe(fix.eval_after_pct);
    expect(r.resolved).toBe(true);
    expect((await feedbackInbox(packId)).find((f) => f.id === fb?.id)?.state).toBe('FIXED');
    // The fix is live for every surface: Ask now resolves the question to the fix's metric.
    const a = (await ask({ packId, personaId: steward, question: fix.feedback_question, agentId: agent.id })).answer;
    expect(a.kind).toBe('answer');
    const target = (fix.fix.payload.maps_to as { ref?: string } | undefined)?.ref;
    if (target) expect(a.metricQuery?.metrics).toContain(target);
  }, 120_000);
});

describe('incident overlay effects on the governed query path', () => {
  it('each utilities template changes data or blocks the metric, and the audit chain still verifies', async () => {
    const pack = getPack('utilities');
    const steward = pack.personas.find((p) => p.archetype === 'D')?.id ?? '';
    const who = principalFor(pack, steward);
    for (const t of pack.incidents) {
      const sql = { kind: 'sql' as const, sql: `SELECT count(*) AS n FROM ${t.object}`, source: 'worksheet' as const };
      const base = await (await governedService('utilities')).run(sql, who);
      const id = await breakNow('utilities', t.id, steward);
      const qs = await governedService('utilities');
      if (t.kind === 'schema_drift') {
        await expect(qs.run({ kind: 'sql', sql: `SELECT sum(${t.column}) FROM ${t.object}`, source: 'worksheet' }, who)).rejects.toThrow(/renamed/);
      } else {
        const during = await qs.run(sql, who);
        expect(during.policiesApplied.some((p) => p.kind === 'incident' && p.ruleOrPolicyId === t.id)).toBe(true);
        if (t.kind !== 'null_spike') expect(during.rows[0]?.[0]).not.toEqual(base.rows[0]?.[0]);
      }
      await resolveNow('utilities', id, steward, new Date());
    }
    expect(verifyChain(await db().auditEvent.findMany({ where: { packId: 'utilities' } })).ok).toBe(true);
  }, 120_000);
});

describe('impact and cost engines', () => {
  it('renaming a contracted Gold column is high severity, a major bump with the rubric notice, and reaches agents', () => {
    const pack = getPack('utilities');
    const view = pack.semantic.find((v) => pack.products.some((p) => p.semantic_view === v.name && p.initial_status === 'CERTIFIED'));
    const fact = view?.tables[0]?.fqn ?? '';
    const metricExpr = view?.metrics[0]?.expr ?? '';
    const column = /[a-z]+\.([a-z_][a-z0-9_]*)/.exec(metricExpr)?.[1] ?? '';
    const r = impactOf(pack, getRubrics(), { fqn: fact, column, change: 'rename' });
    expect(r.metrics.length).toBeGreaterThan(0);
    expect(r.products.length).toBeGreaterThan(0);
    expect(r.agents.length).toBeGreaterThan(0);
    expect(r.severity).toBe('high');
    expect(r.bump).toBe('major');
    expect(r.noticeDays).toBe(getRubrics().contracts.breaking_notice_days);
    expect(r.plan.length).toBeGreaterThan(2);
  });

  it('cost is deterministic and a fresher lag costs more and fixes SLA breaches only by spending', () => {
    for (const id of deep) {
      const pack = getPack(id);
      const lv = defaultLevers(pack);
      const a = computeCost(pack, lv);
      expect(computeCost(pack, lv)).toEqual(a);
      expect(a.total).toBeGreaterThan(0);
      const fresher = computeCost(pack, { ...lv, lagFactor: 0.25 });
      expect(fresher.total).toBeGreaterThan(a.total);
      expect(fresher.byProduct.filter((p) => p.breach).length).toBeLessThanOrEqual(a.byProduct.filter((p) => p.breach).length);
    }
  });
});
