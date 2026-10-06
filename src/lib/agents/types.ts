import type { MetricQuery } from '@/lib/packs/schema';
import type { OutputField, PolicyApplication, ResultSource } from '@/lib/query/types';

export type AnswerKind = 'answer' | 'decline' | 'clarify' | 'redirect' | 'help';
export type AgentMode = 'scripted' | 'live' | 'auto';
export type Confidence = 'trusted' | 'questionable' | 'unsafe';

export interface Citation {
  kind: 'product' | 'metric' | 'rule' | 'verified_query' | 'document' | 'sql';
  ref: string;
  label: string;
  detail?: string;
}

export type TraceStepId = 'understand' | 'context' | 'model' | 'access' | 'query' | 'ground' | 'answer';

export interface TraceStep {
  id: TraceStepId;
  label: string;
  layer: string;
  status: 'ok' | 'skipped' | 'blocked';
  ms: number;
  refs: string[];
  detail: string;
}

export interface Banner {
  kind: 'not_certified' | 'no_access' | 'masked' | 'row_filtered' | 'incident' | 'fallback';
  text: string;
  productId?: string;
}

/** A serialisable governed result attached to an answer (charts/tables render from this, never from text). */
export interface AnswerResult {
  columns: { name: string; type: string }[];
  rows: (string | number | boolean | null)[][];
  fields: OutputField[];
  maskedColumns: string[];
  rowFiltered: boolean;
  displaySql: string;
  policiesApplied: PolicyApplication[];
  sources: ResultSource[];
  queryLogId: string;
  elapsedMs: number;
}

export interface AgentAnswer {
  kind: AnswerKind;
  agentId: string;
  question: string;
  mode: 'scripted' | 'live' | 'live_fallback';
  fallbackReason?: string;
  headline: string;
  narrative: string;
  chart: { type: 'bar' | 'line' | 'table' | 'kpi' | 'none'; x?: string; y?: string };
  result?: AnswerResult;
  citations: Citation[];
  confidence: Confidence;
  banners: Banner[];
  followups: string[];
  trace: TraceStep[];
  scenarioId?: string;
  metricQuery?: MetricQuery;
  rules: string[];
  redirectTo?: { agentId: string; name: string };
  suggestions?: string[];
  requestProductId?: string;
  latencyMs: number;
  /** Live mode: tool calls made, tokens and illustrative cost. */
  toolCalls?: { name: string; ok: boolean; detail: string }[];
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}
