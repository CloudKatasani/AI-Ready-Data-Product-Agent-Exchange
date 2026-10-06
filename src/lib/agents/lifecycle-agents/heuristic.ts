/**
 * Heuristic lifecycle-agent provider (offline, deterministic — 08 §7). Given an artifact's field schema,
 * the current human content and evidence-derived draft values, it proposes values for empty or weaker
 * fields with a rationale per field, and writes a short narrative. Sensitive sample values are redacted
 * unless the agent is allowed sample data.
 */
export interface FieldSpec {
  path: string;
  label: string;
  kind: string;
  sensitive?: boolean;
}

export interface ProposalDraft {
  fieldPath: string;
  value: unknown;
  rationale: string;
}

export interface HeuristicOutput {
  narrative: string;
  proposals: ProposalDraft[];
  redactedFields: string[];
}

const filled = (v: unknown) => !(v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0));
const size = (v: unknown) => (Array.isArray(v) ? v.length : typeof v === 'string' ? v.length : filled(v) ? 1 : 0);

export function heuristicPropose(input: { agentName: string; artifactLabel: string; fields: FieldSpec[]; current: Record<string, unknown>; evidence: Record<string, unknown>; evidenceSources: string[]; allowSampleData: boolean }): HeuristicOutput {
  const proposals: ProposalDraft[] = [];
  const redactedFields: string[] = [];
  for (const f of input.fields) {
    const draft = input.evidence[f.path];
    if (!filled(draft)) continue;
    const cur = input.current[f.path];
    const better = !filled(cur) || (Array.isArray(draft) && size(draft) > size(cur));
    if (!better || JSON.stringify(cur) === JSON.stringify(draft)) continue;
    if (f.sensitive && !input.allowSampleData) redactedFields.push(f.path);
    proposals.push({
      fieldPath: f.path,
      value: draft,
      rationale: filled(cur) ? `Evidence lists ${size(draft)} item(s) for ${f.label.toLowerCase()} where the draft has ${size(cur)}.` : `Drafted ${f.label.toLowerCase()} from ${input.evidenceSources.join(', ')}.`,
    });
  }
  const narrative = proposals.length
    ? `${input.agentName} reviewed ${input.evidenceSources.join(', ')} and proposes ${proposals.length} field value(s) for the ${input.artifactLabel}. Each needs a human decision — accept, edit or reject.`
    : `${input.agentName} found nothing to add to the ${input.artifactLabel}; every field already reflects the evidence.`;
  return { narrative, proposals, redactedFields };
}
