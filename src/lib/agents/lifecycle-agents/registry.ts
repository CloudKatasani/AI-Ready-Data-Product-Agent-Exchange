/**
 * Lifecycle agents (08 §7, ADPM registry shape): who works each stage, what they may read, the highest
 * autonomy they may run at and when they escalate. Agents draft; humans decide (ADR-0008).
 */
export type Autonomy = 'L0' | 'L1' | 'L2' | 'L3';

export interface LifecycleAgentDef {
  id: string;
  name: string;
  charter: string;
  stages: number[];
  readScope: string[];
  outputType: 'proposals' | 'comments' | 'findings';
  autonomyCeiling: Autonomy;
  escalationRule: string;
  wantsSampleData: boolean;
}

export const LIFECYCLE_AGENTS: LifecycleAgentDef[] = [
  { id: 'discovery', name: 'Discovery', charter: 'Turns a blocked decision into a decision register and the questions consumers ask.', stages: [1], readScope: ['intake', 'scenarios'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'Ambiguous decider → ask the product owner', wantsSampleData: false },
  { id: 'curator', name: 'Curator', charter: 'Finds existing products and agents that may already answer the need.', stages: [1], readScope: ['catalog'], outputType: 'comments', autonomyCeiling: 'L2', escalationRule: 'Duplicate above threshold → flag for triage', wantsSampleData: false },
  { id: 'charter', name: 'Charter', charter: 'Drafts purpose, scope, consumers and the value case.', stages: [2], readScope: ['decision-register', 'value'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'No measurable value → escalate to portfolio lead', wantsSampleData: false },
  { id: 'profiling', name: 'Profiling', charter: 'Inventories sources and summarises real profiling results.', stages: [3], readScope: ['warehouse:profile'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'Null rate above SLA → raise a gap', wantsSampleData: true },
  { id: 'modelling', name: 'Modelling', charter: 'Proposes grain, entities, relationships and the ER diagram.', stages: [4], readScope: ['objects', 'semantic'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'Grain conflict → data architect', wantsSampleData: false },
  { id: 'definition', name: 'Definition', charter: 'Drafts the attribute register and the data contract.', stages: [5], readScope: ['glossary', 'policies'], outputType: 'proposals', autonomyCeiling: 'L1', escalationRule: 'Unclassified sensitive column → privacy officer', wantsSampleData: false },
  { id: 'semantic', name: 'Semantic', charter: 'Maps metrics to glossary terms and the semantic view.', stages: [6], readScope: ['semantic', 'glossary', 'verified-queries'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'Metric without term → steward', wantsSampleData: false },
  { id: 'architecture', name: 'Architecture', charter: 'Describes physical objects, refresh and lineage.', stages: [7], readScope: ['objects', 'lineage'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'Lineage gap to Bronze → engineer', wantsSampleData: false },
  { id: 'quality', name: 'Quality', charter: 'Proposes executable DQ rules and the runbook.', stages: [8], readScope: ['dq', 'profile-report'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'Critical rule failing → steward', wantsSampleData: false },
  { id: 'compliance', name: 'Compliance', charter: 'Maps classifications, masking, row access and controls.', stages: [9], readScope: ['policies', 'controls'], outputType: 'proposals', autonomyCeiling: 'L1', escalationRule: 'Missing masking → privacy officer (veto holder)', wantsSampleData: false },
  { id: 'grounding', name: 'Grounding', charter: 'Assembles serving spec, listing and the Gold/Semantic grounding pack.', stages: [10], readScope: ['products', 'documents', 'verified-queries'], outputType: 'proposals', autonomyCeiling: 'L2', escalationRule: 'Non-Gold grounding object → owner', wantsSampleData: false },
  { id: 'evidence', name: 'Evidence', charter: 'Compiles the certification scorecard from the eight checks.', stages: [11], readScope: ['certification'], outputType: 'proposals', autonomyCeiling: 'L1', escalationRule: 'Any failing check → governance council', wantsSampleData: false },
  { id: 'steward', name: 'Steward', charter: 'Monitors freshness, quality and usage; raises findings and change requests.', stages: [12], readScope: ['telemetry', 'dq', 'feedback'], outputType: 'findings', autonomyCeiling: 'L3', escalationRule: 'SLA breach → incident', wantsSampleData: false },
  { id: 'critic', name: 'Critic', charter: 'Reviews any stage and comments on weak or missing fields.', stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], readScope: ['artifacts'], outputType: 'comments', autonomyCeiling: 'L1', escalationRule: 'Never decides', wantsSampleData: false },
];

export function agentForStage(stage: number): LifecycleAgentDef | undefined {
  return LIFECYCLE_AGENTS.find((a) => a.stages.includes(stage) && a.outputType === 'proposals') ?? LIFECYCLE_AGENTS.find((a) => a.stages.includes(stage));
}
