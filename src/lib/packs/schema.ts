/**
 * Zod schemas for every pack file (04-industry-packs §2–3). JSON Schema for editor autocompletion is
 * emitted to `packs/_schema/` by `pnpm pack:schema`.
 */
import type { z } from 'zod';
import type { ControlsFile, DomainsFile, PackManifest, Persona, PoliciesFile } from './schema/identity';
import type { AgentManifest, DataProduct, Scenario } from './schema/catalog';
import type { BusinessRule, DocFrontMatter, GlossaryTerm, Instruction, Kpi, SemanticView, Synonym, VerifiedQuery } from './schema/semantic';
import type { DemandFile, IncidentTemplate, KnockoutFile, ReadinessFile, StoryOverridesFile, ValueCase } from './schema/operate';
import type { DqRule, SourceTable, WarehouseObject } from './schema/warehouse';

export * from './schema/common';
export * from './schema/identity';
export * from './schema/warehouse';
export * from './schema/semantic';
export * from './schema/catalog';
export * from './schema/operate';
export * from './schema/rubrics';

export interface ContextDocument {
  meta: DocFrontMatter;
  /** Path relative to the pack root. */
  path: string;
  body: string;
}

export interface SqlFile {
  /** Path relative to the pack root, e.g. `warehouse/silver/01_customer.sql`. */
  path: string;
  layer: 'silver' | 'gold';
  sql: string;
}

/** A fully loaded, schema-valid pack. Cross-file references are checked by the validator, not here. */
export interface Pack {
  root: string;
  manifest: PackManifest;
  domains: DomainsFile;
  controls: ControlsFile;
  personas: Persona[];
  policies: PoliciesFile;
  sources: SourceTable[];
  objects: WarehouseObject[];
  sql: SqlFile[];
  dq: DqRule[];
  semantic: SemanticView[];
  kpis: Kpi[];
  glossary: GlossaryTerm[];
  instructions: Instruction[];
  rules: BusinessRule[];
  verifiedQueries: VerifiedQuery[];
  synonyms: Synonym[];
  docs: ContextDocument[];
  products: DataProduct[];
  agents: AgentManifest[];
  scenarios: Scenario[];
  incidents: IncidentTemplate[];
  knockout: KnockoutFile;
  value: z.infer<typeof ValueCase>[];
  demand: DemandFile;
  readiness: z.infer<typeof ReadinessFile> | null;
  storyOverrides: z.infer<typeof StoryOverridesFile>;
}
