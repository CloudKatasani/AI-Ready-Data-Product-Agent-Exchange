import { z } from 'zod';
import { AgentId, ColumnFqn, DocId, Fqn, InstructionId, IsoDate, KpiId, MetricQuery, PersonaRef, ProductId, RuleId, SemanticName, TermId, TimeRange, Unit, VerifiedQueryId, ViewName } from './common';

const AliasRef = z.string().regex(/^[a-z][a-z0-9_]*\.[a-z_][a-z0-9_]*$/, 'alias.column');

/** `semantic/*.yaml` — Snowflake semantic-view superset (04 §3.3). */
export const SemanticView = z
  .object({
    name: ViewName,
    description: z.string(),
    tables: z.array(z.object({ alias: z.string().regex(/^[a-z][a-z0-9_]*$/), fqn: Fqn, pk: z.string() }).strict()).min(1),
    /** The first table is the fact; relationships form a tree rooted at it. */
    relationships: z.array(z.object({ from: AliasRef, to: AliasRef }).strict()).default([]),
    dimensions: z
      .array(
        z
          .object({
            name: SemanticName,
            expr: z.string(),
            label: z.string().optional(),
            synonyms: z.array(z.string()).default([]),
            term: TermId.optional(),
            description: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
    time_dimensions: z.array(z.object({ name: SemanticName, expr: z.string(), default: z.boolean().optional() }).strict()).default([]),
    facts: z.array(z.object({ name: SemanticName, expr: z.string(), description: z.string().optional() }).strict()).default([]),
    metrics: z
      .array(
        z
          .object({
            name: SemanticName,
            label: z.string(),
            expr: z.string(),
            unit: Unit,
            decimals: z.number().int().min(0).max(4),
            synonyms: z.array(z.string()).default([]),
            term: TermId,
            description: z.string(),
            direction: z.enum(['higher_is_better', 'lower_is_better', 'neutral']).default('neutral'),
            default_filters: z.array(z.object({ rule: RuleId }).strict()).default([]),
            /** Formula Knockout uses when the Semantic layer is off (05 §1.7). */
            naive_expr: z.string().optional(),
            /**
             * Slice-aware alternatives, most granular first: the compiler uses the first entry whose dimension is
             * grouped by or filtered on (incl. persona row filters), e.g. a ratio whose denominator depends on the slice.
             */
            scope_exprs: z.array(z.object({ dimension: SemanticName, expr: z.string() }).strict()).default([]),
          })
          .strict(),
      )
      .min(1),
    products: z.array(ProductId).min(1),
  })
  .strict();
export type SemanticView = z.infer<typeof SemanticView>;

/** `kpis.yaml` */
export const Kpi = z
  .object({
    id: KpiId,
    name: z.string(),
    definition: z.string(),
    formula: z.string(),
    unit: Unit,
    direction: z.enum(['higher_is_better', 'lower_is_better', 'target_band']),
    target: z.object({ min: z.number(), max: z.number() }).strict(),
    /** Window the KPI is reported over (validator checks the value lands in `target` ± tolerance). */
    window: TimeRange,
    term: TermId,
    metric: SemanticName,
    products: z.array(ProductId).min(1),
  })
  .strict();
export type Kpi = z.infer<typeof Kpi>;
export const KpisFile = z.array(Kpi);

/** `glossary.yaml` */
export const GlossaryTerm = z
  .object({
    id: TermId,
    name: z.string(),
    definition: z.string(),
    formula: z.string().optional(),
    domain: z.string(),
    owner: PersonaRef,
    steward: PersonaRef,
    status: z.enum(['APPROVED', 'IN_REVIEW', 'DRAFT', 'DEPRECATED']),
    cde: z.boolean(),
    synonyms: z.array(z.string()).default([]),
    mappings: z.object({ columns: z.array(ColumnFqn).default([]), metrics: z.array(SemanticName).default([]) }).strict(),
  })
  .strict();
export type GlossaryTerm = z.infer<typeof GlossaryTerm>;
export const GlossaryFile = z.array(GlossaryTerm);

/** `context/instructions.yaml` — four instruction types per agent, versioned. */
export const Instruction = z
  .object({
    id: InstructionId,
    agent: AgentId,
    kind: z.enum(['persona', 'response', 'guardrail', 'orchestration']),
    version: z.number().int().positive(),
    text: z.string().min(20),
  })
  .strict();
export type Instruction = z.infer<typeof Instruction>;
export const InstructionsFile = z.array(Instruction);

/** `context/rules.yaml` — business rules with machine-applicable `apply` blocks (04 §3.4). */
export const BusinessRule = z
  .object({
    id: RuleId,
    domain: z.string(),
    text: z.string(),
    kind: z.enum(['filter', 'definition', 'threshold', 'policy']),
    metric: SemanticName.optional(),
    source_doc: DocId,
    apply: z
      .object({
        filter: z
          .object({ dimension: SemanticName, op: z.enum(['=', '!=', 'in', 'not in', '>', '<', '>=', '<=', 'is null', 'is not null']), value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional() })
          .strict()
          .refine((f) => (f.op === 'is null' || f.op === 'is not null') === (f.value === undefined), { message: '"is null" / "is not null" take no value; every other operator needs one' }),
        unless_question_mentions: z.array(z.string()).default([]),
      })
      .strict()
      .optional(),
  })
  .strict();
export type BusinessRule = z.infer<typeof BusinessRule>;
export const RulesFile = z.array(BusinessRule);

/** `context/verified_queries.yaml` */
export const VerifiedQuery = z
  .object({
    id: VerifiedQueryId,
    question: z.string(),
    query: MetricQuery,
    agent: AgentId.optional(),
    verified_by: PersonaRef,
    verified_at: IsoDate,
    /** `pending_fix` entries are inactive until a certification fix overlay activates them. */
    status: z.enum(['active', 'pending_fix']).default('active'),
  })
  .strict();
export type VerifiedQuery = z.infer<typeof VerifiedQuery>;
export const VerifiedQueriesFile = z.array(VerifiedQuery);

/** `context/synonyms.yaml` */
export const Synonym = z
  .object({
    term: z.string(),
    synonyms: z.array(z.string()).min(1),
    maps_to: z.object({ kind: z.enum(['metric', 'dimension', 'value', 'term']), ref: z.string() }).strict(),
  })
  .strict();
export type Synonym = z.infer<typeof Synonym>;
export const SynonymsFile = z.array(Synonym);

/** Front matter of `context/docs/*.md`. */
export const DocFrontMatter = z
  .object({
    id: DocId,
    title: z.string(),
    domain: z.string(),
    owner: PersonaRef,
    version: z.string(),
    effective: IsoDate,
    /** Document deliberately contains planted prompt-injection lines (adversarial suite, 08 §4.6). */
    contains_injection: z.boolean().default(false),
  })
  .strict();
export type DocFrontMatter = z.infer<typeof DocFrontMatter>;
