import type { MetricQuery, Role, SensitiveClass } from '@/lib/packs/schema';
import type { QueryResult } from '@/lib/warehouse/adapter';

/** Who is asking (02-architecture §4). Resolved server-side from the signed persona cookie. */
export interface Principal {
  packId: string;
  personaId: string;
  archetype: 'A' | 'B' | 'C' | 'D' | 'E';
  roles: Role[];
  rowFilters: { dimension: string; allowed: string[] }[];
  unmasked: SensitiveClass[];
  /** Entitled product ids. */
  entitlements: string[];
  aggregatesOnly: boolean;
}

export type QueryRequest =
  | { kind: 'preview'; fqn: string; limit?: number }
  | { kind: 'sql'; sql: string; source: 'worksheet' | 'profiling' | 'dq-rule' }
  | { kind: 'metric'; query: MetricQuery; purpose: 'agent' | 'playground' | 'kpi-tile' | 'knockout' | 'eval'; question?: string; includeExcluded?: string[] };

export interface PolicyApplication {
  kind: 'entitlement' | 'row_access' | 'masking' | 'incident' | 'limit' | 'rule';
  target: string;
  detail: string;
  ruleOrPolicyId?: string;
}

export interface ResultSource {
  productId: string;
  version: string;
  certified: boolean;
  health: 'healthy' | 'degraded' | 'down';
}

export interface GovernedResult extends QueryResult {
  sql: string;
  displaySql: string;
  policiesApplied: PolicyApplication[];
  maskedColumns: string[];
  rowFiltered: boolean;
  sources: ResultSource[];
  queryLogId: string;
  /** Metric requests only: business rules applied, and the column metadata for formatting. */
  ruleRefs: string[];
  fields: OutputField[];
}

export interface OutputField {
  name: string;
  role: 'period' | 'dimension' | 'metric' | 'derived' | 'column';
  label: string;
  unit?: string;
  decimals?: number;
  /** Source column (`SCHEMA.OBJECT.column`) when the field is a plain column projection. */
  lineage?: string;
}

/** Raised when a principal may not see the data; carries what the UI needs for a Request CTA. */
export class PolicyDenied extends Error {
  constructor(
    message: string,
    readonly productId: string | null,
    readonly requestable: boolean,
  ) {
    super(message);
    this.name = 'PolicyDenied';
  }
}
