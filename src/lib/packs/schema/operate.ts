import { z } from 'zod';
import { AgentId, Archetype, DemandId, Fqn, IncidentId, KnockoutId, KpiId, MetricQuery, PersonaRef, ProductId, RequestId, ValueCaseId } from './common';

/** `incidents.yaml` — "Break something" templates and their effects (05 §2.4). */
export const IncidentTemplate = z
  .object({
    id: IncidentId,
    kind: z.enum(['late_feed', 'null_spike', 'duplicate_load', 'schema_drift', 'volume_anomaly']),
    title: z.string(),
    severity: z.enum(['SEV1', 'SEV2', 'SEV3']),
    object: Fqn,
    column: z.string().optional(),
    params: z
      .object({
        lag_hours: z.number().positive().optional(),
        null_pct: z.number().min(0).max(100).optional(),
        duplicate_pct: z.number().min(0).max(100).optional(),
        rename_to: z.string().optional(),
        missing_days: z.number().int().positive().optional(),
      })
      .strict(),
    affects: z.object({ products: z.array(ProductId).min(1), agents: z.array(AgentId) }).strict(),
    narrative: z.string(),
    detection: z.string(),
    resolution: z.string(),
  })
  .strict();
export type IncidentTemplate = z.infer<typeof IncidentTemplate>;
export const IncidentsFile = z.array(IncidentTemplate);

export const KNOCKOUT_LAYERS = ['silver', 'gold', 'semantic', 'glossary', 'context', 'governance'] as const;
const KnockoutLayer = z.enum(KNOCKOUT_LAYERS);

/** `knockout.yaml` — the governed answers Knockout degrades, and Silver fallbacks for "Gold off". */
export const KnockoutFile = z
  .object({
    answers: z
      .array(
        z
          .object({
            id: KnockoutId,
            kpi: KpiId,
            question: z.string(),
            query: MetricQuery,
            failure_by_layer: z.partialRecord(KnockoutLayer, z.enum(['wrong', 'unsafe', 'ambiguous', 'unverified'])),
            /** Expected relative change (%) when a layer is off; verified against the warehouse in Phase 8. */
            declared_delta_pct: z.partialRecord(KnockoutLayer, z.number()).default({}),
          })
          .strict(),
      )
      .length(4),
    gold_fallbacks: z.array(z.object({ gold: Fqn, silver: Fqn, column_map: z.record(z.string(), z.string()).default({}) }).strict()),
  })
  .strict();
export type KnockoutFile = z.infer<typeof KnockoutFile>;

/** `value.yaml` — value cases per product (marketplace value model). */
export const ValueCase = z
  .object({
    id: ValueCaseId,
    product: ProductId,
    hypothesis: z.string(),
    baseline: z.string(),
    benefit_model: z.string(),
    assumptions: z.array(z.object({ text: z.string(), value: z.number(), unit: z.string(), source: z.string() }).strict()).min(1),
    annual_value_usd: z.number().nonnegative(),
    measured: z.object({ value_usd: z.number(), period: z.string(), confidence: z.enum(['low', 'medium', 'high']) }).strict().nullable(),
  })
  .strict();
export const ValueFile = z.array(ValueCase);

/** `demand.yaml` — seeded intake requests and demand-board items. */
export const DemandFile = z
  .object({
    requests: z.array(
      z
        .object({
          id: RequestId,
          title: z.string(),
          requester: PersonaRef,
          decision: z.string(),
          decider: z.string(),
          cadence: z.string(),
          workaround: z.string(),
          questions: z.array(z.string()).min(3),
          stakes: z.string(),
          freshness: z.string(),
          status: z.enum(['SUBMITTED', 'IN_TRIAGE', 'APPROVED', 'MERGED', 'DECLINED']),
        })
        .strict(),
    ),
    demand_items: z.array(
      z
        .object({ id: DemandId, title: z.string(), kind: z.enum(['product', 'agent']), description: z.string(), requested_by: PersonaRef, votes: z.number().int().nonnegative() })
        .strict(),
    ),
  })
  .strict();
export type DemandFile = z.infer<typeof DemandFile>;

/** `readiness.yaml` — optional preset labels and question text overrides. */
export const ReadinessFile = z
  .object({
    preset_labels: z.record(z.string(), z.string()).default({}),
    question_overrides: z.array(z.object({ id: z.string(), text: z.string() }).strict()).default([]),
  })
  .strict();

/** Story step `go` state (09 §1). */
const StoryGo = z
  .object({
    route: z.string(),
    persona: Archetype,
    state: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  })
  .strict();

/** `packs/_shared/stories.yaml` — the six standard stories. Targets are story-role placeholders resolved per pack. */
export const Story = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string(),
    minutes: z.number().int().positive(),
    audience: z.array(z.string()),
    doors: z.array(z.enum(['HOME', 'CONSUME', 'BUILD', 'RUN', 'STRATEGY'])),
    steps: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z]+\d+$/),
            title: z.string(),
            go: StoryGo,
            /** Story roles (pack.yaml#story_roles) this step targets; validated per pack (category 9). */
            targets: z.array(z.enum(['heroScenario', 'certDemoProduct', 'lifecycleDemoProduct', 'incidentForStory', 'knockoutKpi', 'qualityFixAgent'])).default([]),
            do: z.array(z.string()).min(1),
            say: z.string(),
            expect: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
            spotlight: z.string().optional(),
            checkpoint: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type Story = z.infer<typeof Story>;
export const StoriesFile = z.array(Story).length(6);

/** `packs/<id>/stories.yaml` — optional per-pack cue-card overrides by step id. */
export const StoryOverridesFile = z.array(
  z.object({ story: z.string(), step: z.string(), say: z.string().optional(), do: z.array(z.string()).optional() }).strict(),
);

/** `packs/_shared/adversarial.yaml` — prompt-injection and boundary probes shared by all packs. */
export const AdversarialFile = z.array(
  z
    .object({
      id: z.string().regex(/^ADV-\d{3}$/),
      prompt: z.string(),
      category: z.enum(['injection', 'exfiltration', 'jailbreak', 'masked_data', 'tool_misuse']),
      expect: z.literal('decline'),
    })
    .strict(),
);

