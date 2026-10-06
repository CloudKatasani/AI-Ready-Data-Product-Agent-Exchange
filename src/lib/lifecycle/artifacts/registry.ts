/**
 * Artifact registry (06 §1, ported ADPM shape): 25 artifact types, each with a field schema the Studio
 * editor renders and the lifecycle agents propose against. Content is a flat record keyed by field path.
 */
import type { ArtifactType } from '../stages';

export type FieldKind = 'text' | 'longtext' | 'list' | 'number' | 'select' | 'table';

export interface FieldDef {
  path: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  /** Table columns (kind = table). */
  columns?: string[];
  /** Sensitive fields can't be bulk-accepted from agent proposals (06 §4). */
  sensitive?: boolean;
  help?: string;
}

export interface ArtifactDef {
  type: ArtifactType;
  label: string;
  description: string;
  fields: FieldDef[];
}

const f = (path: string, label: string, kind: FieldKind, extra: Partial<FieldDef> = {}): FieldDef => ({ path, label, kind, required: true, ...extra });

export const ARTIFACTS: Record<ArtifactType, ArtifactDef> = {
  'decision-register': { type: 'decision-register', label: 'Decision register', description: 'The business decision this product supports and who is blocked today.', fields: [f('decision', 'Decision supported', 'longtext'), f('decider', 'Who decides', 'text'), f('cadence', 'Cadence', 'text'), f('workaround', 'Current workaround', 'longtext'), f('consequence', 'Cost of a wrong decision', 'longtext'), f('questions', 'Questions consumers ask', 'list')] },
  charter: { type: 'charter', label: 'Product charter', description: 'Purpose, scope, owner and consumers.', fields: [f('purpose', 'Purpose', 'longtext'), f('scope', 'In scope', 'list'), f('outOfScope', 'Out of scope', 'list', { required: false }), f('owner', 'Owner', 'text'), f('steward', 'Steward', 'text'), f('consumers', 'Consumers', 'list')] },
  'value-case': { type: 'value-case', label: 'Value case', description: 'Hypothesis, baseline, benefit model and assumptions.', fields: [f('hypothesis', 'Hypothesis', 'longtext'), f('baseline', 'Baseline', 'longtext'), f('benefitModel', 'Benefit model', 'text'), f('annualValueUsd', 'Modelled annual value (USD)', 'number'), f('assumptions', 'Assumptions', 'table', { columns: ['assumption', 'value', 'unit', 'source'] })] },
  'source-inventory': { type: 'source-inventory', label: 'Source inventory', description: 'Source objects the product reads.', fields: [f('sources', 'Sources', 'table', { columns: ['object', 'layer', 'system', 'owner'] })] },
  'profile-report': { type: 'profile-report', label: 'Profile report', description: 'Real profiling results per source object (null %, distinct, min/max, top values).', fields: [f('profiledAt', 'Profiled (pack clock)', 'text'), f('objects', 'Objects profiled', 'table', { columns: ['object', 'rows', 'columns', 'worstNullPct', 'notes'] }), f('findings', 'Findings', 'list', { required: false })] },
  'gap-log': { type: 'gap-log', label: 'Gap log', description: 'Data gaps found while profiling and how they are handled.', fields: [f('gaps', 'Gaps', 'table', { columns: ['gap', 'impact', 'resolution'], required: false })] },
  'logical-model': { type: 'logical-model', label: 'Logical model', description: 'Entities, grain and relationships.', fields: [f('grain', 'Grain', 'text'), f('entities', 'Entities', 'table', { columns: ['entity', 'object', 'keys'] }), f('relationships', 'Relationships', 'list', { required: false })] },
  'er-diagram': { type: 'er-diagram', label: 'ER diagram', description: 'Mermaid ER diagram of the logical model.', fields: [f('mermaid', 'Mermaid source', 'longtext')] },
  'attribute-register': { type: 'attribute-register', label: 'Attribute register', description: 'Every output attribute with type, term, classification and CDE flag.', fields: [f('attributes', 'Attributes', 'table', { columns: ['column', 'type', 'term', 'classification', 'cde'], sensitive: true })] },
  'data-contract': { type: 'data-contract', label: 'Data contract', description: 'Consumer-facing contract: schema, SLA, quality and support (ODCS).', fields: [f('version', 'Contract version', 'text'), f('columns', 'Contract columns', 'list', { sensitive: true }), f('freshnessMinutes', 'Freshness SLA (min)', 'number'), f('availabilityPct', 'Availability (%)', 'number'), f('maxNullRatePct', 'Max null rate (%)', 'number'), f('support', 'Support channel', 'text')] },
  'semantic-model': { type: 'semantic-model', label: 'Semantic model', description: 'Semantic view, metrics and their glossary terms.', fields: [f('view', 'Semantic view', 'text'), f('metrics', 'Metrics', 'table', { columns: ['metric', 'label', 'term', 'unit'] }), f('dimensions', 'Dimensions', 'list'), f('verifiedQueries', 'Verified queries', 'number')] },
  'physical-architecture': { type: 'physical-architecture', label: 'Physical architecture', description: 'Storage, refresh and serving objects.', fields: [f('objects', 'Physical objects', 'table', { columns: ['object', 'kind', 'refresh'] }), f('refresh', 'Refresh pattern', 'text')] },
  'lineage-diagram': { type: 'lineage-diagram', label: 'Lineage', description: 'Bronze → Silver → Gold → semantic → product lineage.', fields: [f('edges', 'Lineage edges', 'list'), f('complete', 'Lineage to Bronze complete', 'select', { options: ['yes', 'no'] })] },
  'quality-rules': { type: 'quality-rules', label: 'Quality rules', description: 'Executable DQ assertions and the latest results.', fields: [f('rules', 'Rules', 'table', { columns: ['rule', 'dimension', 'assertion', 'severity'] }), f('lastScore', 'Latest quality score', 'number', { required: false })] },
  runbook: { type: 'runbook', label: 'Runbook', description: 'On-call, alert routes and recovery steps.', fields: [f('onCall', 'On call', 'text'), f('alerts', 'Alert routes', 'list'), f('recovery', 'Recovery steps', 'list')] },
  'access-policy': { type: 'access-policy', label: 'Access policy', description: 'Classifications, masking, row access and grants.', fields: [f('classifications', 'Sensitive classes', 'list', { required: false, sensitive: true }), f('masking', 'Masking policies', 'list', { required: false, sensitive: true }), f('rowAccess', 'Row access policies', 'list', { required: false }), f('approvers', 'Access approver roles', 'list')] },
  'regulatory-map': { type: 'regulatory-map', label: 'Regulatory map', description: 'Controls this product evidences.', fields: [f('controls', 'Controls', 'table', { columns: ['control', 'requirement', 'evidence'], required: false })] },
  'serving-spec': { type: 'serving-spec', label: 'Serving spec', description: 'Output ports and endpoints.', fields: [f('ports', 'Output ports', 'table', { columns: ['kind', 'ref'] })] },
  'marketplace-listing': { type: 'marketplace-listing', label: 'Marketplace listing', description: 'How the product appears in the Marketplace.', fields: [f('name', 'Name', 'text'), f('summary', 'Summary', 'longtext'), f('sampleQuestions', 'Sample questions', 'list'), f('kpis', 'KPIs', 'list')] },
  'grounding-pack': { type: 'grounding-pack', label: 'Grounding pack', description: 'What agents may ground answers on — Gold/Semantic only.', fields: [f('objects', 'Grounding objects', 'list'), f('documents', 'Documents', 'list', { required: false }), f('verifiedQueries', 'Verified queries', 'list', { required: false })] },
  'certification-scorecard': { type: 'certification-scorecard', label: 'Certification scorecard', description: 'The eight automated certification checks with evidence.', fields: [f('checks', 'Checks', 'table', { columns: ['check', 'status', 'detail'] }), f('datsis', 'DATSIS+V scores (0–5)', 'table', { columns: ['dimension', 'score'], required: false })] },
  telemetry: { type: 'telemetry', label: 'Telemetry', description: 'Usage, freshness and quality signals.', fields: [f('signals', 'Signals monitored', 'list')] },
  'feedback-log': { type: 'feedback-log', label: 'Feedback log', description: 'Consumer feedback and responses.', fields: [f('entries', 'Entries', 'list', { required: false })] },
  'change-requests': { type: 'change-requests', label: 'Change requests', description: 'Open change requests and version impact.', fields: [f('requests', 'Requests', 'list', { required: false })] },
  'benefit-realisation': { type: 'benefit-realisation', label: 'Benefit realisation', description: 'Measured value against the value case.', fields: [f('measuredUsd', 'Measured value (USD)', 'number', { required: false }), f('period', 'Period', 'text', { required: false }), f('confidence', 'Confidence', 'select', { options: ['low', 'medium', 'high'], required: false })] },
};

export type ArtifactContent = Record<string, unknown>;

export function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Required fields that are empty. */
export function missingFields(type: ArtifactType, content: ArtifactContent): string[] {
  return ARTIFACTS[type].fields.filter((x) => x.required && !isFilled(content[x.path])).map((x) => x.path);
}
