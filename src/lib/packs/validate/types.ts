export const CATEGORIES = {
  1: 'Schema',
  2: 'Referential',
  3: 'Quotas',
  4: 'Warehouse',
  5: 'Semantics',
  6: 'Governance',
  7: 'Scenarios',
  8: 'Agents',
  9: 'Stories',
  10: 'Domain-string lint input',
  11: 'Golden drift',
} as const;
export type Category = keyof typeof CATEGORIES;

export interface CheckResult {
  category: Category;
  /** Stable check name, e.g. `ref.kpi.term`. */
  check: string;
  ok: boolean;
  severity: 'error' | 'warning';
  message: string;
  subject?: string;
}

/** Collects atomic checks. Every assertion counts toward the ≥ 500-checks-per-deep-pack target (04 §7). */
export class Checks {
  constructor(
    readonly results: CheckResult[],
    private readonly category: Category,
  ) {}

  /** A checker for another category writing into the same result list. */
  in(category: Category): Checks {
    return new Checks(this.results, category);
  }

  expect(ok: boolean, check: string, message: string, subject?: string): boolean {
    this.results.push({ category: this.category, check, ok, severity: 'error', message, subject });
    return ok;
  }

  warn(ok: boolean, check: string, message: string, subject?: string): boolean {
    this.results.push({ category: this.category, check, ok, severity: 'warning', message, subject });
    return ok;
  }

  /** `ref` must be one of `known`. */
  ref(known: ReadonlySet<string>, ref: string | null | undefined, check: string, where: string): boolean {
    if (ref === null || ref === undefined) return true;
    return this.expect(known.has(ref), check, `${where} references unknown ${check.split('.').pop()} "${ref}"`, where);
  }
}

export interface ValidationReport {
  packId: string;
  results: CheckResult[];
  errors: CheckResult[];
  warnings: CheckResult[];
  checks: number;
  byCategory: Record<string, { checks: number; errors: number; warnings: number }>;
  /** Category 10 output: terms the domain-string lint keeps out of src/. */
  lintTerms: string[];
}

export function summarise(packId: string, results: CheckResult[], lintTerms: string[]): ValidationReport {
  const byCategory: ValidationReport['byCategory'] = {};
  for (const r of results) {
    const key = `${r.category} ${CATEGORIES[r.category]}`;
    const c = (byCategory[key] ??= { checks: 0, errors: 0, warnings: 0 });
    c.checks++;
    if (!r.ok && r.severity === 'error') c.errors++;
    if (!r.ok && r.severity === 'warning') c.warnings++;
  }
  return {
    packId,
    results,
    errors: results.filter((r) => !r.ok && r.severity === 'error'),
    warnings: results.filter((r) => !r.ok && r.severity === 'warning'),
    checks: results.length,
    byCategory,
    lintTerms,
  };
}
