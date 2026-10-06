/** pnpm pack:schema — emits JSON Schema for every pack file to packs/_schema/ (editor autocompletion). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import * as S from '../src/lib/packs/schema';

const FILES: Record<string, z.ZodType> = {
  'pack.schema.json': S.PackManifest,
  'domains.schema.json': S.DomainsFile,
  'controls.schema.json': S.ControlsFile,
  'personas.schema.json': S.PersonasFile,
  'policies.schema.json': S.PoliciesFile,
  'sources.schema.json': S.SourcesFile,
  'objects.schema.json': S.ObjectsFile,
  'dq.schema.json': S.DqFile,
  'semantic-view.schema.json': S.SemanticView,
  'kpis.schema.json': S.KpisFile,
  'glossary.schema.json': S.GlossaryFile,
  'instructions.schema.json': S.InstructionsFile,
  'rules.schema.json': S.RulesFile,
  'verified-queries.schema.json': S.VerifiedQueriesFile,
  'synonyms.schema.json': S.SynonymsFile,
  'doc-front-matter.schema.json': S.DocFrontMatter,
  'product.schema.json': S.DataProduct,
  'agent.schema.json': S.AgentManifest,
  'scenarios.schema.json': S.ScenariosFile,
  'incidents.schema.json': S.IncidentsFile,
  'knockout.schema.json': S.KnockoutFile,
  'value.schema.json': S.ValueFile,
  'demand.schema.json': S.DemandFile,
  'readiness.schema.json': S.ReadinessFile,
  'stories.schema.json': S.StoriesFile,
  'story-overrides.schema.json': S.StoryOverridesFile,
  'adversarial.schema.json': S.AdversarialFile,
  'rubrics.schema.json': S.Rubrics,
};

const out = join(process.cwd(), 'packs', '_schema');
mkdirSync(out, { recursive: true });
for (const [file, schema] of Object.entries(FILES)) {
  writeFileSync(join(out, file), `${JSON.stringify(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), null, 2)}\n`);
}
console.log(`wrote ${Object.keys(FILES).length} schemas to packs/_schema/`);
