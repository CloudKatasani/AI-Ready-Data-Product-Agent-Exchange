import { z } from 'zod';

/** Shared vocabulary for pack files (CLAUDE.md §5). Pure Zod — no I/O. */

export const LAYERS = ['bronze', 'silver', 'gold', 'semantic', 'glossary', 'context', 'product', 'agent', 'governance'] as const;
export const Layer = z.enum(LAYERS);
export type Layer = z.infer<typeof Layer>;

export const SENSITIVE_CLASSES = ['PII', 'PHI', 'PCI', 'CPNI', 'NPI', 'GOV_ID', 'TRADE_SECRET'] as const;
export const SensitiveClass = z.enum(SENSITIVE_CLASSES);
export type SensitiveClass = z.infer<typeof SensitiveClass>;

export const ROLES = [
  'DATA_CONSUMER',
  'ANALYST',
  'DOMAIN_PRODUCT_OWNER',
  'DATA_ENGINEER',
  'DATA_STEWARD',
  'GOVERNANCE_COUNCIL',
  'PRIVACY_OFFICER',
  'EXECUTIVE',
  'PORTFOLIO_LEAD',
  'PLATFORM_ADMIN',
] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const Archetype = z.enum(['A', 'B', 'C', 'D', 'E']);
export type Archetype = z.infer<typeof Archetype>;

export const Scale = z.enum(['S', 'M', 'L']);
export type Scale = z.infer<typeof Scale>;

export const Semver = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'semantic version (x.y.z)');
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date (YYYY-MM-DD)');

/** Pack code segment of ids, e.g. `UTL` in `DP-UTL-002`. */
const CODE = '[A-Z]{2,4}';
const id = (prefix: string, tail: string, example: string) =>
  z.string().regex(new RegExp(`^${prefix}-${CODE}-${tail}$`), `id like ${example}`);

export const ProductId = id('DP', '\\d{3}', 'DP-UTL-002');
export const AgentId = id('AG', '\\d{3}', 'AG-UTL-002');
export const KpiId = id('KPI', '[A-Z0-9-]+', 'KPI-UTL-SAIDI');
export const TermId = id('GT', '[A-Z0-9-]+', 'GT-UTL-SAIDI');
export const RuleId = id('BR', '\\d{3}', 'BR-UTL-012');
export const VerifiedQueryId = id('VQ', '\\d{3}', 'VQ-UTL-049');
export const ScenarioId = id('SC', '\\d{3}', 'SC-UTL-001');
export const InstructionId = id('INS', '\\d{3}-[PRGO]', 'INS-UTL-002-P');
export const DocId = id('DOC', '[A-Z0-9-]+', 'DOC-UTL-RELIABILITY-STD');
export const DqRuleId = id('DQ', '\\d{3}', 'DQ-UTL-017');
export const IncidentId = id('INC', '[A-Z0-9-]+', 'INC-UTL-LATE-FEED');
export const ValueCaseId = id('VC', '\\d{3}', 'VC-UTL-002');
export const ControlId = id('CTL', '\\d{3}', 'CTL-UTL-001');
export const PlantId = id('P', '\\d{2}', 'P-UTL-01');
export const RequestId = id('REQ', '\\d{3}', 'REQ-UTL-001');
export const DemandId = id('DM', '\\d{3}', 'DM-UTL-001');
export const KnockoutId = id('KO', '\\d{2}', 'KO-UTL-01');

/** Persona references are `<packId>:<slug>`, e.g. `utilities:grid-dpo`. */
export const PersonaRef = z.string().regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, 'persona ref like utilities:grid-dpo');

/** Warehouse identifiers (Snowflake conventions): upper-case schema and object names. */
export const ObjectName = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'UPPER_SNAKE object name');
export const ColumnName = z.string().regex(/^[a-z_][a-z0-9_]*$/, 'lower_snake column name');
/** Fully qualified object name within the pack database: `SCHEMA.OBJECT`. */
export const Fqn = z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/, 'SCHEMA.OBJECT');
/** Column reference: `SCHEMA.OBJECT.column`. */
export const ColumnFqn = z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\.[a-z_][a-z0-9_]*$/, 'SCHEMA.OBJECT.column');
/** Semantic-name identifier (metrics, dimensions, facts). */
export const SemanticName = z.string().regex(/^[a-z][a-z0-9_]*$/, 'lower_snake name');
export const ViewName = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'UPPER_SNAKE view name');

export const TimeUnit = z.enum(['day', 'week', 'month', 'quarter', 'year']);
export type TimeUnit = z.infer<typeof TimeUnit>;

export const TimeRange = z
  .object({
    from: IsoDate.optional(),
    to: IsoDate.optional(),
    last: z.object({ n: z.number().int().positive(), unit: z.enum(['day', 'month', 'quarter', 'year']) }).strict().optional(),
    /** Year to date relative to pack.asOf. */
    ytd: z.boolean().optional(),
  })
  .strict();
export type TimeRange = z.infer<typeof TimeRange>;

export const FilterOp = z.enum(['=', '!=', 'in', 'not in', '>', '<', '>=', '<=', 'between']);
export type FilterOp = z.infer<typeof FilterOp>;

const Scalar = z.union([z.string(), z.number(), z.boolean()]);

export const MetricFilter = z
  .object({ dimension: SemanticName, op: FilterOp, value: z.union([Scalar, z.array(Scalar)]) })
  .strict();
export type MetricFilter = z.infer<typeof MetricFilter>;

/** The single intermediate representation for every governed question (ADR-0004, 02-architecture §4). */
export const MetricQuery = z
  .object({
    view: ViewName,
    metrics: z.array(SemanticName).min(1),
    dimensions: z.array(SemanticName).optional(),
    timeGrain: TimeUnit.optional(),
    timeRange: TimeRange.optional(),
    filters: z.array(MetricFilter).optional(),
    orderBy: z.array(z.object({ field: SemanticName, dir: z.enum(['asc', 'desc']) }).strict()).optional(),
    limit: z.number().int().positive().optional(),
    analysis: z.enum(['value', 'trend', 'rank', 'contribution', 'distribution', 'compare_target']).optional(),
  })
  .strict();
export type MetricQuery = z.infer<typeof MetricQuery>;

/** Lucide icon name (kebab-case). */
export const IconName = z.string().regex(/^[a-z][a-z0-9-]*$/);

export const Unit = z.string().min(1);
