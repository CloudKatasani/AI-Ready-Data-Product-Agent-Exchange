import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import {
  AgentManifest,
  ControlsFile,
  DataProduct,
  DemandFile,
  DocFrontMatter,
  DomainsFile,
  DqFile,
  GlossaryFile,
  IncidentsFile,
  InstructionsFile,
  KnockoutFile,
  KpisFile,
  ObjectsFile,
  type ContextDocument,
  type Pack,
  PackManifest,
  PersonasFile,
  PoliciesFile,
  ReadinessFile,
  RulesFile,
  ScenariosFile,
  SemanticView,
  SourcesFile,
  type SqlFile,
  StoryOverridesFile,
  SynonymsFile,
  ValueFile,
  VerifiedQueriesFile,
} from './schema';

export interface LoadIssue {
  file: string;
  path: string;
  message: string;
}

export class PackLoadError extends Error {
  constructor(
    readonly packRoot: string,
    readonly issues: LoadIssue[],
  ) {
    super(`Pack at ${packRoot} failed to load:\n${issues.map((i) => `  ${i.file}${i.path ? ` ${i.path}` : ''}: ${i.message}`).join('\n')}`);
  }
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext) && statSync(join(dir, f)).isFile())
    .sort()
    .map((f) => join(dir, f));
}

/** Parses YAML front matter delimited by `---` lines. */
export function splitFrontMatter(text: string): { data: unknown; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: undefined, body: text };
  return { data: parseYaml(m[1] ?? ''), body: m[2] ?? '' };
}

class Reader {
  readonly issues: LoadIssue[] = [];
  constructor(readonly root: string) {}

  rel(file: string): string {
    return relative(this.root, file);
  }

  raw(file: string): unknown {
    try {
      return parseYaml(readFileSync(file, 'utf8'));
    } catch (e) {
      this.issues.push({ file: this.rel(file), path: '', message: `YAML parse error: ${(e as Error).message}` });
      return undefined;
    }
  }

  parse<S extends z.ZodType>(schema: S, value: unknown, file: string): z.infer<S> | undefined {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const issue of r.error.issues) {
      this.issues.push({ file: this.rel(file), path: issue.path.join('.'), message: issue.message });
    }
    return undefined;
  }

  file<S extends z.ZodType>(schema: S, rel: string, opts: { optional?: boolean } = {}): z.infer<S> | undefined {
    const file = join(this.root, rel);
    if (!existsSync(file)) {
      if (!opts.optional) this.issues.push({ file: rel, path: '', message: 'required file is missing' });
      return undefined;
    }
    const value = this.raw(file);
    return value === undefined ? undefined : this.parse(schema, value, file);
  }

  /** Each YAML file in `dir` parsed with `schema`; array-valued files are concatenated. */
  many<S extends z.ZodType>(schema: S, relDir: string): z.infer<S>[] {
    return listFiles(join(this.root, relDir), '.yaml').flatMap((file) => {
      const value = this.raw(file);
      const parsed = value === undefined ? undefined : this.parse(schema, value, file);
      return parsed === undefined ? [] : [parsed];
    });
  }
}

/** Loads and schema-validates one pack directory. Never throws for content problems — see `issues`. */
export function readPack(root: string): { pack: Pack | undefined; issues: LoadIssue[] } {
  const r = new Reader(root);
  const manifest = r.file(PackManifest, 'pack.yaml');
  const domains = r.file(DomainsFile, 'domains.yaml');
  const controls = r.file(ControlsFile, 'controls.yaml');
  const personas = r.file(PersonasFile, 'personas.yaml');
  const policies = r.file(PoliciesFile, 'policies.yaml');
  const sources = r.file(SourcesFile, 'warehouse/sources.yaml');
  const objects = r.file(ObjectsFile, 'warehouse/objects.yaml');
  const dq = r.many(DqFile, 'warehouse/dq').flat();
  const semantic = r.many(SemanticView, 'semantic');
  const kpis = r.file(KpisFile, 'kpis.yaml');
  const glossary = r.file(GlossaryFile, 'glossary.yaml');
  const instructions = r.file(InstructionsFile, 'context/instructions.yaml');
  const rules = r.file(RulesFile, 'context/rules.yaml');
  const verifiedQueries = r.file(VerifiedQueriesFile, 'context/verified_queries.yaml');
  const synonyms = r.file(SynonymsFile, 'context/synonyms.yaml');
  const products = r.many(DataProduct, 'products');
  const agents = r.many(AgentManifest, 'agents');
  const scenarios = r.file(ScenariosFile, 'scenarios.yaml');
  const incidents = r.file(IncidentsFile, 'incidents.yaml');
  const knockout = r.file(KnockoutFile, 'knockout.yaml');
  const value = r.file(ValueFile, 'value.yaml');
  const demand = r.file(DemandFile, 'demand.yaml');
  const readiness = r.file(ReadinessFile, 'readiness.yaml', { optional: true });
  const storyOverrides = r.file(StoryOverridesFile, 'stories.yaml', { optional: true }) ?? [];

  const sql: SqlFile[] = (['silver', 'gold'] as const).flatMap((layer) =>
    listFiles(join(root, 'warehouse', layer), '.sql').map((file) => ({ path: r.rel(file), layer, sql: readFileSync(file, 'utf8') })),
  );

  const docs: ContextDocument[] = listFiles(join(root, 'context', 'docs'), '.md').flatMap((file) => {
    const { data, body } = splitFrontMatter(readFileSync(file, 'utf8'));
    const meta = r.parse(DocFrontMatter, data, file);
    return meta ? [{ meta, path: r.rel(file), body }] : [];
  });

  const required = { manifest, domains, controls, personas, policies, sources, objects, kpis, glossary, instructions, rules, verifiedQueries, synonyms, scenarios, incidents, knockout, value, demand };
  const missing = Object.entries(required).filter(([, v]) => v === undefined);
  if (missing.length > 0 || r.issues.length > 0) return { pack: undefined, issues: r.issues };

  const pack: Pack = {
    root,
    manifest: manifest!,
    domains: domains!,
    controls: controls!,
    personas: personas!,
    policies: policies!,
    sources: sources!.tables,
    objects: objects!.objects,
    sql,
    dq,
    semantic,
    kpis: kpis!,
    glossary: glossary!,
    instructions: instructions!,
    rules: rules!,
    verifiedQueries: verifiedQueries!,
    synonyms: synonyms!,
    docs,
    products,
    agents,
    scenarios: scenarios!,
    incidents: incidents!,
    knockout: knockout!,
    value: value!,
    demand: demand!,
    readiness: readiness ?? null,
    storyOverrides,
  };
  return { pack, issues: [] };
}

export function loadPack(root: string): Pack {
  const { pack, issues } = readPack(root);
  if (!pack) throw new PackLoadError(root, issues);
  return pack;
}

/** Reads and validates one shared file under `packs/_shared/`. */
export function loadSharedFile<S extends z.ZodType>(packsDir: string, name: string, schema: S): z.infer<S> {
  const file = join(packsDir, '_shared', name);
  const r = new Reader(join(packsDir, '_shared'));
  const value = r.raw(file);
  const parsed = value === undefined ? undefined : r.parse(schema, value, file);
  if (parsed === undefined) throw new PackLoadError(file, r.issues);
  return parsed;
}
