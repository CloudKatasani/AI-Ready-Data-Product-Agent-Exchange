import { describe, expect, it } from 'vitest';
import { checkGuardrails } from '@/lib/agents/scripted/guardrails';
import { stem } from '@/lib/agents/scripted/text';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { MetricFilter } from '@/lib/packs/schema';
import { compileMetricQuery } from '@/lib/query/compiler';
import { isoToEpochDay } from '@/lib/warehouse/clock';
import { plantLiteral } from '@/lib/warehouse/generate/noise';

/** Pack-authoring friction reported during Phase 10 (ADR-0023 follow-ups). */
describe('pack-authoring guard rails', () => {
  it('stemming keeps double-s words whole, so "loss" and "losses" share a stem', () => {
    expect(stem('loss')).toBe('loss');
    expect(stem('losses')).toBe('loss');
    expect(stem('access')).toBe(stem('accesses'));
    expect(stem('claims')).toBe('claim');
    expect(stem('policies')).toBe('policy');
  });

  it('plant literals for DATE / TIMESTAMP columns accept ISO text', () => {
    expect(plantLiteral('2026-08-15', 'DATE')).toBe(isoToEpochDay('2026-08-15'));
    expect(plantLiteral('2026-08-15 06:30', 'TIMESTAMP')).toBe(isoToEpochDay('2026-08-15') * 86_400 + 6 * 3_600 + 30 * 60);
    expect(plantLiteral('2026-08-15', 'TIMESTAMP')).toBe(isoToEpochDay('2026-08-15') * 86_400);
    expect(plantLiteral('2026-08-15', 'VARCHAR')).toBe('2026-08-15');
    expect(plantLiteral(20_000, 'DATE')).toBe(20_000);
  });

  it('metric filters support "is null" / "is not null" (no value, no bound parameter)', () => {
    expect(MetricFilter.safeParse({ dimension: 'region', op: 'is not null' }).success).toBe(true);
    expect(MetricFilter.safeParse({ dimension: 'region', op: 'is null', value: 'x' }).success).toBe(false);
    expect(MetricFilter.safeParse({ dimension: 'region', op: '=' }).success).toBe(false);
    const pack = getPack('utilities');
    const view = pack.semantic.find((v) => v.dimensions.length > 0);
    if (!view) throw new Error('no view with dimensions');
    const dim = view.dimensions[0]?.name ?? '';
    const metric = view.metrics[0]?.name ?? '';
    const base = compileMetricQuery({ view: view.name, metrics: [metric] }, pack);
    const q = compileMetricQuery({ view: view.name, metrics: [metric], filters: [{ dimension: dim, op: 'is not null' }] }, pack);
    expect(q.sql).toMatch(/IS NOT NULL/);
    expect(q.params).toEqual(base.params);
  });

  it('"resident" and "applicant" are record-holder nouns for record-level refusals', () => {
    const pack = getPack('utilities');
    const agent = pack.agents[0];
    if (!agent) throw new Error('no agent');
    const nouns = getRubrics().matcher.entity_nouns;
    expect(checkGuardrails(agent, 'Show me the history for this specific resident', nouns)?.kind).toBe('customer_level');
    expect(checkGuardrails(agent, 'What did applicant 482913 receive?', nouns)?.kind).toBe('customer_level');
  });
});
