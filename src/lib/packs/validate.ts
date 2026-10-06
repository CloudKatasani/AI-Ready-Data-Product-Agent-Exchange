/**
 * Pack validator (04 §7). Static categories live here (1–3, 5, 6, 9, 10); category 4 needs a built
 * warehouse and lives in `src/lib/warehouse/validate.ts`; 7–8 arrive with the compiler and agents.
 */
import { indexPack } from './index-pack';
import { readPack } from './loader';
import type { Pack, Story } from './schema';
import { checkGovernance, checkQuotas, checkSemantics, checkStories, lintTerms } from './validate/policy-checks';
import { checkIdentity, checkObjects, checkReferences, checkSemantic, checkSources } from './validate/references';
import { type CheckResult, Checks, summarise, type ValidationReport } from './validate/types';

export type { CheckResult, ValidationReport } from './validate/types';
export { CATEGORIES, Checks, summarise } from './validate/types';

/** Runs every static check on an already loaded pack. */
export function staticChecks(pack: Pack, stories: Story[], results: CheckResult[] = []): CheckResult[] {
  const idx = indexPack(pack);
  const c = new Checks(results, 1);
  checkIdentity(c, pack);
  const refs = c.in(2);
  checkSources(refs, pack);
  checkObjects(refs, pack, idx);
  checkSemantic(refs, pack, idx);
  checkReferences(refs, pack, idx);
  checkQuotas(c.in(3), pack);
  checkSemantics(c.in(5), pack, idx);
  checkGovernance(c.in(6), pack, idx);
  checkStories(c.in(9), pack, idx, stories);
  return results;
}

/** Loads a pack directory and validates it statically. Schema problems become category-1 errors. */
export function validatePackStatic(root: string, stories: Story[]): { pack: Pack | undefined; report: ValidationReport } {
  const { pack, issues } = readPack(root);
  const results: CheckResult[] = issues.map((i) => ({
    category: 1,
    check: 'schema.parse',
    ok: false,
    severity: 'error',
    message: `${i.file}${i.path ? ` ${i.path}` : ''}: ${i.message}`,
    subject: i.file,
  }));
  const id = root.split('/').pop() ?? root;
  if (!pack) return { pack, report: summarise(id, results, []) };
  results.push({ category: 1, check: 'schema.parse', ok: true, severity: 'error', message: 'all pack files parse against their schemas' });
  staticChecks(pack, stories, results);
  const terms = lintTerms(pack);
  results.push({ category: 10, check: 'lint.terms', ok: terms.length > 0, severity: 'error', message: `${terms.length} domain terms emitted for the domain-string lint` });
  return { pack, report: summarise(pack.manifest.id, results, terms) };
}
