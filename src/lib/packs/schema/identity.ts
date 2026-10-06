import { z } from 'zod';
import {
  AgentId,
  Archetype,
  ControlId,
  IconName,
  IsoDate,
  KpiId,
  PersonaRef,
  ProductId,
  Role,
  ScenarioId,
  Semver,
  SensitiveClass,
  ColumnFqn,
  Fqn,
  IncidentId,
} from './common';

/** `pack.yaml` — identity, company, locale, clock, regions, home config (04 §3.1). */
export const PackManifest = z
  .object({
    id: z.string().regex(/^_?[a-z][a-z0-9-]*$/),
    name: z.string().min(1),
    version: Semver,
    depth: z.enum(['deep', 'standard', 'draft']),
    /** Id segment used in every pack id (`DP-<code>-001`). */
    code: z.string().regex(/^[A-Z]{2,4}$/),
    industry: z.string().min(1),
    company: z.object({ name: z.string(), short: z.string().regex(/^[A-Z]{2,5}$/), hq: z.string(), description: z.string() }).strict(),
    database: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    locale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    asOf: IsoDate,
    seed: z.number().int().nonnegative(),
    regions: z.array(z.string().min(1)).min(2),
    overridable: z.object({ regions: z.boolean(), companyName: z.boolean(), terms: z.array(z.string()) }).strict(),
    home: z
      .object({
        heroQuestion: z.string().min(10),
        heroAgent: AgentId,
        headlineKpis: z.array(KpiId).min(1).max(4),
        theatreScenarios: z.array(ScenarioId).min(1).max(3),
      })
      .strict(),
    icon: IconName,
    hook: z.string().min(1),
    story_roles: z
      .object({
        heroScenario: ScenarioId,
        certDemoProduct: ProductId,
        lifecycleDemoProduct: ProductId,
        incidentForStory: IncidentId,
        knockoutKpi: KpiId,
        qualityFixAgent: AgentId,
      })
      .strict(),
    /** Extra industry words the domain-string lint must keep out of src/ (invariant I01). */
    lint_terms: z.array(z.string()).default([]),
  })
  .strict();
export type PackManifest = z.infer<typeof PackManifest>;

/** `domains.yaml` — domains, conformed backbone entities and links (ADPM). */
export const DomainsFile = z
  .object({
    domains: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]*$/),
            name: z.string(),
            description: z.string(),
            owner: PersonaRef,
            entities: z.array(z.string()).min(1),
          })
          .strict(),
      )
      .min(1),
    backbone: z
      .object({
        entities: z.array(z.object({ name: z.string(), description: z.string(), key: z.string(), domain: z.string(), golden_source: Fqn.optional() }).strict()),
        links: z.array(z.object({ from: z.string(), to: z.string(), cardinality: z.enum(['1:1', '1:N', 'N:1', 'N:M']), via: z.string().optional() }).strict()),
      })
      .strict(),
  })
  .strict();
export type DomainsFile = z.infer<typeof DomainsFile>;

/** `controls.yaml` — control library and jurisdictions. */
export const ControlsFile = z
  .object({
    jurisdictions: z.array(z.object({ id: z.string(), name: z.string(), regulator: z.string() }).strict()),
    controls: z.array(
      z
        .object({
          id: ControlId,
          name: z.string(),
          framework: z.string(),
          description: z.string(),
          jurisdiction: z.string().optional(),
          applies_to: z.object({ classes: z.array(SensitiveClass).optional(), domains: z.array(z.string()).optional() }).strict(),
          evidence: z.string(),
          stage: z.number().int().min(1).max(12).optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type ControlsFile = z.infer<typeof ControlsFile>;

/** `personas.yaml` — exactly one persona per archetype A–E. */
export const Persona = z
  .object({
    id: PersonaRef,
    archetype: Archetype,
    name: z.string(),
    title: z.string(),
    domain: z.string(),
    roles: z.array(Role).min(1),
    row_filter: z.object({ dimension: z.string(), allowed: z.array(z.string()).min(1) }).strict().optional(),
    unmasked: z.array(SensitiveClass),
    aggregates_only: z.boolean().default(false),
    cares: z.string(),
    sees: z.string(),
  })
  .strict();
export type Persona = z.infer<typeof Persona>;
export const PersonasFile = z.array(Persona).length(5);

/** `policies.yaml` — sensitivity tags, masking, row access and initial grants. */
export const PoliciesFile = z
  .object({
    sensitivity_classes: z.array(z.object({ class: SensitiveClass, description: z.string() }).strict()).min(1),
    masking_policies: z.array(
      z
        .object({
          id: z.string().regex(/^MASK_[A-Z_]+$/),
          class: SensitiveClass,
          /** DuckDB macro created at warehouse build (GOVERNANCE schema). */
          macro: z.enum(['mask_pii', 'mask_email', 'mask_phone', 'mask_pci', 'mask_gov_id', 'mask_redact']),
          description: z.string(),
        })
        .strict(),
    ),
    row_access_policies: z.array(
      z
        .object({
          id: z.string().regex(/^RAP_[A-Z_]+$/),
          dimension: z.string(),
          description: z.string(),
          bindings: z.array(z.object({ object: Fqn, column: z.string() }).strict()).min(1),
        })
        .strict(),
    ),
    /** Column classifications for Silver/Gold/product objects (Bronze columns carry tags in sources.yaml). */
    column_tags: z.array(
      z
        .object({
          column: ColumnFqn,
          classes: z.array(SensitiveClass).default([]),
          cde: z.boolean().default(false),
          masking: z.string().regex(/^MASK_[A-Z_]+$/).optional(),
          /** Masking is NOT attached until this certification fix is applied (gate-6 failure story). */
          mask_pending_fix: z.string().optional(),
        })
        .strict(),
    ),
    grants: z.array(z.object({ persona: PersonaRef, products: z.array(ProductId), agents: z.array(AgentId).default([]) }).strict()),
    /** Products readable by every persona without a grant. */
    public_products: z.array(ProductId).default([]),
  })
  .strict();
export type PoliciesFile = z.infer<typeof PoliciesFile>;
