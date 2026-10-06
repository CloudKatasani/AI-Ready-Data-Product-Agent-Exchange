/**
 * The 12-stage governed lifecycle (06 §1): phases, artifacts per stage, the lifecycle agent that works
 * each stage and the human gate at its exit. Spec roles are mapped onto pack roles (ADR-0017).
 */
import type { Role } from '@/lib/packs/schema';

export const PHASES = ['Discover', 'Design', 'Build', 'Certify & Publish', 'Operate'] as const;
export type Phase = (typeof PHASES)[number];

export type ArtifactType =
  | 'decision-register'
  | 'charter'
  | 'value-case'
  | 'source-inventory'
  | 'profile-report'
  | 'gap-log'
  | 'logical-model'
  | 'er-diagram'
  | 'attribute-register'
  | 'data-contract'
  | 'semantic-model'
  | 'physical-architecture'
  | 'lineage-diagram'
  | 'quality-rules'
  | 'runbook'
  | 'access-policy'
  | 'regulatory-map'
  | 'serving-spec'
  | 'marketplace-listing'
  | 'grounding-pack'
  | 'certification-scorecard'
  | 'telemetry'
  | 'feedback-log'
  | 'change-requests'
  | 'benefit-realisation';

export interface GateDef {
  roles: Role[];
  quorum: number;
  veto: Role[];
}

export interface StageDef {
  n: number;
  name: string;
  phase: Phase;
  artifacts: ArtifactType[];
  agent: string;
  gate: GateDef | null;
}

export const STAGES: StageDef[] = [
  { n: 1, name: 'Consumption Discovery', phase: 'Discover', artifacts: ['decision-register'], agent: 'Discovery', gate: { roles: ['DOMAIN_PRODUCT_OWNER'], quorum: 1, veto: [] } },
  { n: 2, name: 'Charter & Value Case', phase: 'Discover', artifacts: ['charter', 'value-case'], agent: 'Charter', gate: { roles: ['DOMAIN_PRODUCT_OWNER', 'PORTFOLIO_LEAD'], quorum: 2, veto: [] } },
  { n: 3, name: 'Source Discovery & Profiling', phase: 'Design', artifacts: ['source-inventory', 'profile-report', 'gap-log'], agent: 'Profiling', gate: { roles: ['DATA_ENGINEER', 'DATA_STEWARD'], quorum: 2, veto: [] } },
  { n: 4, name: 'Conceptual & Logical Model', phase: 'Design', artifacts: ['logical-model', 'er-diagram'], agent: 'Modelling', gate: { roles: ['DATA_ENGINEER'], quorum: 1, veto: [] } },
  { n: 5, name: 'Attribute Register & Data Contract', phase: 'Design', artifacts: ['attribute-register', 'data-contract'], agent: 'Definition', gate: { roles: ['DATA_STEWARD', 'DOMAIN_PRODUCT_OWNER'], quorum: 2, veto: [] } },
  { n: 6, name: 'Semantic Model & Metrics', phase: 'Build', artifacts: ['semantic-model'], agent: 'Semantic', gate: { roles: ['DATA_STEWARD'], quorum: 1, veto: [] } },
  { n: 7, name: 'Physical Architecture', phase: 'Build', artifacts: ['physical-architecture', 'lineage-diagram'], agent: 'Architecture', gate: { roles: ['DATA_ENGINEER'], quorum: 1, veto: [] } },
  { n: 8, name: 'Quality & Observability', phase: 'Build', artifacts: ['quality-rules', 'runbook'], agent: 'Quality', gate: { roles: ['DATA_STEWARD'], quorum: 1, veto: [] } },
  { n: 9, name: 'Access & Governance', phase: 'Certify & Publish', artifacts: ['access-policy', 'regulatory-map'], agent: 'Compliance', gate: { roles: ['PRIVACY_OFFICER'], quorum: 1, veto: ['PRIVACY_OFFICER'] } },
  { n: 10, name: 'Serving & Consumption', phase: 'Certify & Publish', artifacts: ['serving-spec', 'marketplace-listing', 'grounding-pack'], agent: 'Grounding', gate: { roles: ['DOMAIN_PRODUCT_OWNER'], quorum: 1, veto: [] } },
  { n: 11, name: 'Certification & Publication', phase: 'Certify & Publish', artifacts: ['certification-scorecard'], agent: 'Evidence', gate: { roles: ['GOVERNANCE_COUNCIL'], quorum: 2, veto: ['GOVERNANCE_COUNCIL'] } },
  { n: 12, name: 'Operate, Evolve & Retire', phase: 'Operate', artifacts: ['telemetry', 'feedback-log', 'change-requests', 'benefit-realisation'], agent: 'Steward', gate: null },
];

export function stageDef(n: number): StageDef {
  const s = STAGES.find((x) => x.n === n);
  if (!s) throw new Error(`Unknown stage ${n}`);
  return s;
}

export function stageOfArtifact(type: ArtifactType): number {
  return STAGES.find((s) => s.artifacts.includes(type))?.n ?? 0;
}

/** Product status implied by the lifecycle position (Stage 12 is reached only through gate 11). */
export function statusForStage(stage: number): 'DRAFT' | 'IN_DEVELOPMENT' | 'IN_CERTIFICATION' | 'CERTIFIED' {
  if (stage >= 12) return 'CERTIFIED';
  if (stage === 11) return 'IN_CERTIFICATION';
  if (stage >= 3) return 'IN_DEVELOPMENT';
  return 'DRAFT';
}
