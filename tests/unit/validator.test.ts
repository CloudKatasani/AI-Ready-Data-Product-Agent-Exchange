import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStories, packsDir } from '@/lib/packs/registry';
import { validatePackStatic } from '@/lib/packs/validate';

const stories = getStories();

function mutatedCopy(edit: (root: string) => void): string {
  const root = join(mkdtempSync(join(tmpdir(), 'keystone-pack-')), 'utilities');
  cpSync(join(packsDir(), 'utilities'), root, { recursive: true });
  edit(root);
  return root;
}

function replaceIn(root: string, rel: string, from: string, to: string): void {
  const p = join(root, rel);
  const s = readFileSync(p, 'utf8');
  if (!s.includes(from)) throw new Error(`fixture text not found in ${rel}: ${from}`);
  writeFileSync(p, s.replace(from, to));
}

describe('pack validator (static categories)', () => {
  it('passes the utilities pack with ≥ 500 checks', () => {
    const { report } = validatePackStatic(join(packsDir(), 'utilities'), stories);
    expect(report.errors.map((e) => e.message)).toEqual([]);
    expect(report.checks).toBeGreaterThanOrEqual(500);
    expect(report.lintTerms).toContain('Northvale Energy');
  });

  it.each([
    ['schema', 'kpis.yaml', 'direction: lower_is_better', 'direction: sideways', 'schema.parse'],
    ['unknown term', 'kpis.yaml', 'term: GT-UTL-SAIDI', 'term: GT-UTL-NOPE', 'ref.kpi.term'],
    ['unknown metric in a scenario', 'scenarios.yaml', 'metrics: [saidi]', 'metrics: [saidi_typo]', 'ref.query.metric'],
    ['fk to a missing table', 'warehouse/sources.yaml', 'fk: { table: OMS_CREW,', 'fk: { table: OMS_CREWS,', 'ref.source.fk_table'],
    ['grant to a missing product', 'policies.yaml', 'products: [DP-UTL-001, DP-UTL-002, DP-UTL-003]', 'products: [DP-UTL-001, DP-UTL-002, DP-UTL-099]', 'ref.grant.product'],
    ['certified product exposing unmasked PII', 'policies.yaml', '{ column: CONFORMED_GOLD.DIM_CUSTOMER.full_name, classes: [PII], masking: MASK_PII }', '{ column: CONFORMED_GOLD.DIM_CUSTOMER.full_name, classes: [PII], masking: MASK_PII, mask_pending_fix: FIX-1 }', 'governance.certified_masking'],
  ])('flags %s', (_name, file, from, to, check) => {
    const root = mutatedCopy((r) => replaceIn(r, file, from, to));
    const { report } = validatePackStatic(root, stories);
    expect(report.errors.map((e) => e.check)).toContain(check);
  });
});
