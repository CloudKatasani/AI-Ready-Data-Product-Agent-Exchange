import { describe, expect, it } from 'vitest';
import { dqMetricSql, dqPasses } from '@/lib/packs/dq';
import { DqRule } from '@/lib/packs/schema';

const rule = (over: Partial<DqRule>) =>
  DqRule.parse({ id: 'DQ-TST-001', object: 'CONFORMED_GOLD.FCT_X', column: 'amount', dimension: 'completeness', assertion: 'null_rate <= 0.01', severity: 'high', alert_route: 'steward', description: 'x', ...over });

describe('DQ SQL builder', () => {
  it('builds metric SQL per assertion metric', () => {
    expect(dqMetricSql(rule({})).sql).toContain('CASE WHEN "amount" IS NULL');
    expect(dqMetricSql(rule({ assertion: 'row_count >= 1', column: undefined })).sql).toContain('count(*)');
    expect(dqMetricSql(rule({ assertion: 'invalid_rate <= 0', allowed: ['A', "B'"] })).sql).toContain("IN ('A', 'B''')");
    expect(dqMetricSql(rule({ assertion: 'regex_rate >= 0.99', pattern: '^F-\\d+$' })).sql).toContain('regexp_full_match');
  });

  it('requires pattern/allowed/column where needed', () => {
    expect(() => dqMetricSql(rule({ assertion: 'regex_rate >= 1' }))).toThrow(/pattern/);
    expect(() => dqMetricSql(rule({ assertion: 'null_rate <= 0', column: undefined }))).toThrow(/column/);
  });

  it('compares observations', () => {
    expect(dqPasses(0.004, '<=', 0.005)).toBe(true);
    expect(dqPasses(0.006, '<=', 0.005)).toBe(false);
    expect(dqPasses(null, '>=', 1)).toBe(false);
    expect(dqPasses(3, '==', 3)).toBe(true);
  });
});
