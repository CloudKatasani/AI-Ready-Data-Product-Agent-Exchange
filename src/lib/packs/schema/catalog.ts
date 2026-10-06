import { z } from 'zod';
import { AgentId, DocId, Fqn, IconName, InstructionId, KpiId, PersonaRef, ProductId, ScenarioId, Semver, ValueCaseId, VerifiedQueryId, ViewName, ColumnFqn, MetricQuery } from './common';

export const PRODUCT_STATUSES = ['CERTIFIED', 'IN_CERTIFICATION', 'IN_DEVELOPMENT', 'DRAFT'] as const;

/** `products/DP-*.yaml` (04 §3.5). */
export const DataProduct = z
  .object({
    id: ProductId,
    name: z.string(),
    domain: z.string(),
    archetype: z.enum(['SOURCE_ALIGNED', 'AGGREGATE', 'CONSUMER_ALIGNED', 'ENTITY_MASTER']),
    initial_status: z.enum(PRODUCT_STATUSES),
    seed_stage: z.number().int().min(1).max(12),
    version: Semver,
    owner: PersonaRef,
    steward: PersonaRef.nullable(),
    description: z.string(),
    purpose: z.string(),
    decision: z.object({ persona: z.string(), decision: z.string(), cadence: z.string(), workaround: z.string(), consequence: z.string() }).strict(),
    sample_questions: z.array(z.string()).min(1),
    semantic_view: ViewName.nullable(),
    output_ports: z.array(z.object({ kind: z.enum(['semantic', 'sql', 'api', 'agent']), ref: z.string() }).strict()).min(1),
    sla: z.object({ freshness_minutes: z.number().int().positive(), availability_pct: z.number().min(0).max(100), max_null_rate_pct: z.number().min(0).max(100) }).strict(),
    kpis: z.array(KpiId),
    upstream: z.array(Fqn).min(1),
    consumers: z.array(z.string()).default([]),
    lifecycle_seed: z.object({ artifacts: z.literal('auto'), open_proposals: z.boolean().default(false) }).strict(),
    certification_script: z
      .object({
        initial: z.record(z.string().regex(/^gate\d+$/), z.enum(['warn', 'fail'])),
        fixes: z
          .array(
            z
              .object({
                id: z.string().regex(/^FIX-\d+$/),
                check: z.string(),
                label: z.string(),
                effect: z.union([
                  z.object({ overlay: z.literal('VERIFIED_QUERY'), keys: z.array(VerifiedQueryId).min(1) }).strict(),
                  z.object({ policy_attach: z.object({ policy: z.string(), columns: z.array(ColumnFqn).min(1) }).strict() }).strict(),
                ]),
              })
              .strict(),
          )
          .min(1),
      })
      .strict()
      .nullable(),
    value_case: ValueCaseId.nullable(),
  })
  .strict();
export type DataProduct = z.infer<typeof DataProduct>;

/** `agents/AG-*.yaml` — domain agent manifest (08 §2). */
export const AgentManifest = z
  .object({
    id: AgentId,
    name: z.string(),
    domain: z.string(),
    status: z.enum(['PILOT', 'CANARY', 'PRODUCTION']),
    owner: PersonaRef,
    on_call: z.string(),
    avatar: z.object({ icon: IconName, hue: z.number().int().min(0).max(360) }).strict(),
    capability: z.string(),
    personas_served: z.array(z.string()).min(1),
    out_of_scope: z.array(z.string()).min(3),
    products: z.array(z.object({ id: ProductId, columns: z.union([z.literal('*'), z.array(z.string()).min(1)]) }).strict()),
    tools: z
      .array(
        z.union([
          z.object({ tool: z.literal('semantic_query'), views: z.array(ViewName).min(1), row_limit: z.number().int().positive() }).strict(),
          z.object({ tool: z.literal('search_context'), corpora: z.array(DocId).min(1) }).strict(),
          z.object({ tool: z.enum(['get_definition', 'get_product_status', 'list_metrics', 'request_access_link']) }).strict(),
        ]),
      )
      .min(1),
    kpi_coverage: z.array(
      z
        .object({
          kpi: KpiId,
          grains: z.array(z.enum(['day', 'week', 'month', 'quarter', 'year'])),
          slices: z.array(z.string()),
          depth: z.enum(['value', 'trend', 'explain', 'rank_drivers']),
        })
        .strict(),
    ),
    instructions: z.array(InstructionId).length(4),
    guardrails: z
      .object({ citations_required: z.boolean(), refuse_customer_level: z.boolean(), pii_output: z.enum(['deny', 'masked']), max_followups: z.number().int().min(0) })
      .strict(),
    budgets: z.object({ cost_per_answer_usd: z.number().positive(), p95_latency_ms: z.number().int().positive(), max_tool_rounds: z.number().int().positive() }).strict(),
    eval: z
      .object({ golden_min: z.number(), groundedness_min: z.number(), boundary_min: z.number(), adversarial_min: z.number(), entitlement_min: z.number() })
      .strict(),
    scenarios: z.array(ScenarioId),
    /** Agent Quality story: cases that fail before the scripted fix and the declared eval delta (01 M10). */
    quality_fix: z
      .object({
        feedback_question: z.string(),
        fix: z.object({ type: z.enum(['synonym', 'business_rule', 'verified_query', 'instruction']), payload: z.record(z.string(), z.unknown()) }).strict(),
        eval_before_pct: z.number(),
        eval_after_pct: z.number(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type AgentManifest = z.infer<typeof AgentManifest>;

export const ANSWER_KINDS = ['answer', 'decline', 'clarify', 'redirect', 'help'] as const;
export const AnswerKind = z.enum(ANSWER_KINDS);

/** `scenarios.yaml` (04 §3.7). Numbers come from golden.json; `expect` holds shape assertions. */
export const Scenario = z
  .object({
    id: ScenarioId,
    agent: AgentId,
    pattern: z.number().int().min(1).max(15),
    question: z.string(),
    paraphrases: z.array(z.string()).default([]),
    kind: AnswerKind.default('answer'),
    query: MetricQuery.nullable(),
    answer: z
      .object({ headline: z.string(), narrative: z.string(), chart: z.enum(['bar', 'line', 'table', 'kpi', 'none']) })
      .strict(),
    followups: z.array(z.string()).default([]),
    redirect_to: AgentId.optional(),
    expect: z
      .object({
        rows: z.number().int().nonnegative().optional(),
        top: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
        rules: z.array(z.string()).optional(),
        certified: z.boolean().optional(),
      })
      .strict()
      .default({}),
    personas_expect: z
      .partialRecord(
        z.enum(['A', 'B', 'C', 'D', 'E']),
        z.object({ kind: AnswerKind.optional(), rowFiltered: z.boolean().optional(), masked: z.array(z.string()).optional() }).strict(),
      )
      .default({}),
  })
  .strict();
export type Scenario = z.infer<typeof Scenario>;
export const ScenariosFile = z.array(Scenario);

