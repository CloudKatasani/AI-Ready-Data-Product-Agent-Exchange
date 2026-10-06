import { z } from 'zod';

const Weights = z.record(z.string(), z.number().nonnegative());

/** `packs/_shared/rubrics.yaml` — every threshold and weight engines use (never literals in code). */
export const Rubrics = z
  .object({
    version: z.string(),
    quality: z.object({ dimensions: Weights, tiers: z.record(z.string(), z.number()) }).strict(),
    certification: z
      .object({ dq_pass: z.number(), dq_warn: z.number(), min_verified_queries: z.number().int(), semantic_eval_min: z.number(), agent_eval_min: z.number() })
      .strict(),
    matcher: z.object({ run_threshold: z.number(), clarify_threshold: z.number(), redirect_margin: z.number(), entity_nouns: z.array(z.string().min(2)).min(1) }).strict(),
    agentEval: z
      .object({
        golden_min: z.number(),
        groundedness_min: z.number(),
        boundary_min: z.number(),
        adversarial_min: z.number(),
        entitlement_min: z.number(),
        compositional_min: z.number(),
        weights: Weights,
      })
      .strict(),
    grounding: z.object({ derived_value_tolerance_rel: z.number(), ignore_numbers: z.array(z.string()) }).strict(),
    confidence: z.record(z.string(), z.record(z.string(), z.union([z.boolean(), z.number()]))),
    query: z.object({ max_rows_agent: z.number().int(), max_rows_worksheet: z.number().int(), statement_timeout_ms: z.number().int(), preview_rows: z.number().int() }).strict(),
    llm: z
      .object({
        timeout_ms: z.number().int(),
        max_tool_rounds: z.number().int(),
        session_budget_usd: z.number(),
        pricing_illustrative_per_mtok: z.record(z.string(), z.object({ in: z.number(), out: z.number() }).strict()),
      })
      .strict(),
    intake: z.object({ duplicate_similarity: z.number(), triage_sla_hours: z.number() }).strict(),
    prioritisation: z.object({ model: z.enum(['WSJF', 'RICE']), wsjf_weights: Weights }).strict(),
    readiness: z
      .object({ target: z.number(), weights: Weights, bands: z.record(z.string(), z.tuple([z.number(), z.number()])) })
      .strict(),
    contracts: z.object({ breaking_notice_days: z.number().int() }).strict(),
    demo: z.object({ reset_target_ms: z.number().int(), scripted_answer_budget_ms: z.number().int() }).strict(),
  })
  .strict();
export type Rubrics = z.infer<typeof Rubrics>;
