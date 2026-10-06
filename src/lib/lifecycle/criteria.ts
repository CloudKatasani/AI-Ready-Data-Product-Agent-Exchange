/**
 * Exit criteria per stage (06 §2): required artifact fields filled, no unreviewed agent output (I05), plus
 * Keystone's stage-specific checks (real profiling at 3, a compiling semantic model at 6, DQ score at 8,
 * Gold/Semantic-only grounding at 10, all certification checks at 11). Pure over gathered facts.
 */
import type { Rubrics } from '@/lib/packs/schema';
import { ARTIFACTS, type ArtifactContent, missingFields } from './artifacts/registry';
import type { CheckResult } from './certification';
import { type ArtifactType, stageDef } from './stages';

export interface CriteriaFacts {
  contents: Partial<Record<ArtifactType, ArtifactContent>>;
  openProposals: number;
  qualityScore: number | null;
  semanticErrors: string[] | null;
  checks: CheckResult[] | null;
  waivedChecks?: string[];
  /** Source objects that must have profiling results (Stage 3). */
  profileTargets: string[];
}

export interface Criterion {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export function exitCriteria(stage: number, rubrics: Rubrics, f: CriteriaFacts): Criterion[] {
  const def = stageDef(stage);
  const out: Criterion[] = [];
  for (const type of def.artifacts) {
    const content = f.contents[type];
    const missing = content ? missingFields(type, content) : ARTIFACTS[type].fields.filter((x) => x.required).map((x) => x.path);
    out.push({ id: `artifact.${type}`, label: `${ARTIFACTS[type].label} complete`, ok: Boolean(content) && missing.length === 0, detail: !content ? 'Not started' : missing.length ? `Missing: ${missing.join(', ')}` : 'All required fields filled' });
  }
  out.push({ id: 'no_unreviewed_agent_fields', label: 'No unreviewed agent output', ok: f.openProposals === 0, detail: f.openProposals ? `${f.openProposals} agent proposal(s) still need a human decision` : 'Every agent proposal has been reviewed' });

  if (stage === 3) {
    const profiled = new Set(((f.contents['profile-report']?.objects as { object: string }[] | undefined) ?? []).map((o) => o.object));
    const missing = f.profileTargets.filter((o) => !profiled.has(o));
    out.push({ id: 'profiling_executed', label: 'Profiling executed on every source object', ok: missing.length === 0 && f.profileTargets.length > 0, detail: missing.length ? `Not profiled: ${missing.join(', ')}` : `${f.profileTargets.length} object(s) profiled` });
  }
  if (stage === 6) {
    const errs = f.semanticErrors;
    out.push({ id: 'semantic_compiles', label: 'Semantic model compiles and every metric returns a value', ok: errs !== null && errs.length === 0, detail: errs === null ? 'Not checked yet' : errs.length ? errs.join('; ') : 'All metrics return values' });
  }
  if (stage === 8) {
    const q = f.qualityScore;
    out.push({ id: 'dq_score', label: `Quality score ≥ ${rubrics.certification.dq_warn}`, ok: q !== null && q >= rubrics.certification.dq_warn, detail: q === null ? 'DQ rules not run yet' : `Score ${q}` });
  }
  if (stage === 10) {
    const objs = (f.contents['grounding-pack']?.objects as string[] | undefined) ?? [];
    const bad = objs.filter((o) => !/^(CONFORMED_GOLD|SEMANTIC)\./.test(o));
    out.push({ id: 'grounding_layers', label: 'Grounding pack uses Gold/Semantic layers only', ok: objs.length > 0 && bad.length === 0, detail: bad.length ? `Not allowed: ${bad.join(', ')}` : `${objs.length} grounding object(s)` });
  }
  if (stage === 11) {
    const checks = f.checks ?? [];
    const blocking = checks.filter((c) => c.status === 'fail' || (c.status === 'warn' && !f.waivedChecks?.includes(c.id)));
    out.push({ id: 'certification_checks', label: 'All certification checks pass', ok: checks.length === 8 && blocking.length === 0, detail: !checks.length ? 'Checks not evaluated' : blocking.length ? `${blocking.map((c) => `${c.label} (${c.status})`).join(', ')}` : 'All 8 checks pass' });
  }
  return out;
}

export const criteriaMet = (c: Criterion[]) => c.every((x) => x.ok);
