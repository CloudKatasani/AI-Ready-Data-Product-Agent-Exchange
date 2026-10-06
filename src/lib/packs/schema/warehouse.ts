import { z } from 'zod';
import { ColumnName, DqRuleId, Fqn, IsoDate, ObjectName, PlantId, SensitiveClass } from './common';

/** Generator vocabulary for Bronze tables (04 §5). Every primitive is deterministic under `rng(seed)`. */

const DateOrAsOf = z.union([IsoDate, z.literal('asOf')]);
const Clamp = { min: z.number().optional(), max: z.number().optional(), decimals: z.number().int().min(0).max(6).optional() };

const Seasonality = z
  .object({
    month: z.array(z.number().nonnegative()).length(12).optional(),
    weekday: z.array(z.number().nonnegative()).length(7).optional(),
  })
  .strict();

export const GenSpec = z.union([
  z.object({ seq: z.object({ prefix: z.string().default(''), pad: z.number().int().min(0).default(0), start: z.number().int().default(1) }).strict() }).strict(),
  z.object({ choice: z.object({ values: z.array(z.union([z.string(), z.number(), z.boolean()])).min(1), weights: z.array(z.number().nonnegative()).optional() }).strict() }).strict(),
  z.object({ bernoulli: z.number().min(0).max(1) }).strict(),
  z.object({ uniform: z.object({ min: z.number(), max: z.number(), decimals: Clamp.decimals }).strict() }).strict(),
  z.object({ normal: z.object({ mean: z.number(), sd: z.number().nonnegative(), ...Clamp }).strict() }).strict(),
  z.object({ lognormal: z.object({ mu: z.number(), sigma: z.number().nonnegative(), ...Clamp }).strict() }).strict(),
  z.object({ poisson: z.object({ lambda: z.number().positive(), ...Clamp }).strict() }).strict(),
  z
    .object({
      datetime: z
        .object({ from: DateOrAsOf, to: DateOrAsOf, seasonality: Seasonality.optional(), business_hours: z.boolean().optional() })
        .strict(),
    })
    .strict(),
  z.object({ date: z.object({ from: DateOrAsOf, to: DateOrAsOf, seasonality: Seasonality.optional() }).strict() }).strict(),
  /** Date offset from an earlier date/datetime column of the same row (e.g. due date = statement + 21 days). */
  z
    .object({
      date_offset: z
        .object({ from_column: ColumnName, days: z.object({ min: z.number().int(), max: z.number().int() }).strict(), clamp_to_as_of: z.boolean().optional() })
        .strict(),
    })
    .strict(),
  z
    .object({
      fk: z
        .object({ table: ObjectName, column: ColumnName, dist: z.enum(['uniform', 'zipf', 'sequential']).default('uniform'), s: z.number().positive().default(1.1) })
        .strict(),
    })
    .strict(),
  z.object({ template: z.string().min(1) }).strict(),
  z.object({ person: z.enum(['first', 'last', 'full']) }).strict(),
  z.object({ company: z.literal(true) }).strict(),
  z.object({ address: z.literal(true) }).strict(),
  z.object({ email: z.object({ first: ColumnName, last: ColumnName, domain: z.string().default('example.com') }).strict() }).strict(),
  z.object({ phone: z.literal(true) }).strict(),
  /** Arithmetic/conditional expression over earlier columns of the same row (safe evaluator, no eval). */
  z.object({ formula: z.string().min(1), ...Clamp }).strict(),
  /** Copy a column from the parent row picked by an earlier `fk` column. */
  z.object({ derive_from: z.object({ fk_column: ColumnName, parent_column: ColumnName }).strict() }).strict(),
  z.object({ const: z.union([z.string(), z.number(), z.boolean()]) }).strict(),
]);
export type GenSpec = z.infer<typeof GenSpec>;

export const ColumnType = z
  .string()
  .regex(/^(VARCHAR|INTEGER|BIGINT|DOUBLE|BOOLEAN|DATE|TIMESTAMP|DECIMAL\(\d+,\d+\))$/, 'VARCHAR|INTEGER|BIGINT|DOUBLE|BOOLEAN|DATE|TIMESTAMP|DECIMAL(p,s)');
export type ColumnType = z.infer<typeof ColumnType>;

export const SourceColumn = z
  .object({
    name: ColumnName,
    type: ColumnType,
    description: z.string().optional(),
    gen: GenSpec,
    null_pct: z.number().min(0).max(100).optional(),
    tags: z.array(SensitiveClass).default([]),
    /** Eligible for CDC dirty-string noise (mixed case, padding). Defaults by generator kind. */
    dirty: z.boolean().optional(),
  })
  .strict();
export type SourceColumn = z.infer<typeof SourceColumn>;

const Match = z.union([z.string(), z.number(), z.boolean(), z.object({ in: z.array(z.union([z.string(), z.number()])).min(1) }).strict()]);

export const Plant = z
  .object({
    id: PlantId,
    description: z.string(),
    where: z.record(ColumnName, Match).default({}),
    window: z.object({ column: ColumnName, from: IsoDate, to: IsoDate }).strict().optional(),
    adjust: z.record(
      ColumnName,
      z
        .object({
          multiply: z.number().optional(),
          add: z.number().optional(),
          set: z.union([z.string(), z.number(), z.boolean()]).optional(),
          /** Share of matching rows adjusted (deterministic per row). Default 100. */
          pct: z.number().min(0).max(100).optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type Plant = z.infer<typeof Plant>;

export const SourceTable = z
  .object({
    name: ObjectName,
    system: z.string(),
    description: z.string(),
    /** Natural key column; CDC duplicates/deletes are keyed on it and Silver deduplicates on it. */
    key: ColumnName,
    rows: z.object({ S: z.number().int().positive(), M: z.number().int().positive(), L: z.number().int().positive() }).strict(),
    cdc_noise: z
      .object({
        duplicate_updates_pct: z.number().min(0).max(50).default(0),
        deletes_pct: z.number().min(0).max(20).default(0),
        dirty_strings_pct: z.number().min(0).max(50).default(0),
        late_arrivals_pct: z.number().min(0).max(20).default(0),
      })
      .strict()
      .default({ duplicate_updates_pct: 0, deletes_pct: 0, dirty_strings_pct: 0, late_arrivals_pct: 0 }),
    /** Column whose value drives `_loaded_at` (event time + small lag). Defaults to asOf-relative load times. */
    loaded_at_from: ColumnName.optional(),
    columns: z.array(SourceColumn).min(2),
    plant: z.array(Plant).default([]),
  })
  .strict();
export type SourceTable = z.infer<typeof SourceTable>;

export const SourcesFile = z.object({ tables: z.array(SourceTable).min(1) }).strict();
export type SourcesFile = z.infer<typeof SourcesFile>;

export const DQ_DIMENSIONS = ['completeness', 'validity', 'uniqueness', 'timeliness', 'consistency', 'accuracy'] as const;
export const DqDimension = z.enum(DQ_DIMENSIONS);

/** `warehouse/dq/*.yaml` — executable DQ rules (05 §5). */
export const DqRule = z
  .object({
    id: DqRuleId,
    object: Fqn,
    column: ColumnName.optional(),
    dimension: DqDimension,
    /** `<metric> <op> <number>`; metrics: null_rate, distinct_ratio, dup_rate, min, max, regex_rate, invalid_rate, freshness_min, row_count. */
    assertion: z
      .string()
      .regex(/^(null_rate|distinct_ratio|dup_rate|min|max|regex_rate|invalid_rate|freshness_min|row_count)\s*(<=|>=|<|>|==)\s*-?\d+(\.\d+)?$/),
    pattern: z.string().optional(),
    allowed: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    alert_route: z.enum(['steward', 'owner', 'engineering']),
    description: z.string(),
  })
  .strict();
export type DqRule = z.infer<typeof DqRule>;
export const DqFile = z.array(DqRule);

/** Metadata for Silver/Gold SQL objects, declared in `warehouse/objects.yaml` (display + lineage). */
export const WarehouseObject = z
  .object({
    fqn: Fqn,
    kind: z.enum(['TABLE', 'DYNAMIC TABLE', 'VIEW']),
    description: z.string(),
    target_lag: z.string().optional(),
    upstream: z.array(Fqn).min(1),
    grain: z.string().optional(),
  })
  .strict();
export type WarehouseObject = z.infer<typeof WarehouseObject>;
export const ObjectsFile = z.object({ objects: z.array(WarehouseObject) }).strict();
