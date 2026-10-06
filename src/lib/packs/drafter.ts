/**
 * Pack Drafter, offline mode (01 §M13): clone the nearest deep pack and re-skin it — new pack id and code,
 * fictional company, database name and regions — as a `draft`. Every id that carries the source code
 * (`DP-UTL-001` → `DP-WTR-001`) is rewritten, the company and region names are replaced as whole words, and
 * golden answers are not copied: a draft is never used in scripted stories until its golden set is approved.
 * Pure: files in, files out (the CLI writes them and runs the validator).
 */
import { parse, stringify } from 'yaml';

export interface DraftInput {
  /** New pack id (folder name), e.g. `water`. */
  id: string;
  /** Display name, e.g. `Water utility`. */
  name: string;
  /** Three-letter id code, e.g. `WTR`. */
  code: string;
  industry: string;
  company: { name: string; short: string; hq: string; description: string };
  /** Replacement region names, by position (missing positions keep the source name). */
  regions: string[];
}

export class DraftError extends Error {}

const ID = /^[a-z][a-z0-9-]{1,30}$/;
const CODE = /^[A-Z]{2,4}$/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function validateDraftInput(input: DraftInput, existing: string[]): void {
  if (!ID.test(input.id)) throw new DraftError('Pack id: lowercase letters, digits and dashes.');
  if (existing.includes(input.id)) throw new DraftError(`Pack ${input.id} already exists.`);
  if (!CODE.test(input.code)) throw new DraftError('Code: 2–4 capital letters.');
  if (!input.company.name.trim() || !input.company.short.trim()) throw new DraftError('Company name and short name are required.');
}

interface Source {
  id: string;
  code: string;
  companyName: string;
  companyShort: string;
  hq: string;
  database: string;
  regions: string[];
}

/** Re-skins one file's text. IDs first (code), then company names, then regions (whole words). */
function reskin(text: string, src: Source, input: DraftInput): string {
  let out = text.replace(new RegExp(`\\b([A-Z]{1,5})-${src.code}-`, 'g'), `$1-${input.code}-`);
  // Persona ids are prefixed with the pack id (`utilities:coo`).
  out = out.replace(new RegExp(`\\b${esc(src.id)}:([a-z][a-z0-9-]*)`, 'g'), `${input.id}:$1`);
  const db = `${input.company.short.toUpperCase().replace(/[^A-Z0-9]/g, '')}_AI_PLATFORM`;
  const pairs: [string, string][] = [
    [src.database, db],
    [src.companyName, input.company.name],
    // The company is often called by its first word alone ("<First>'s records").
    [src.companyName.split(' ')[0] ?? '', input.company.name.split(' ')[0] ?? input.company.name],
    [src.hq, input.company.hq],
    [src.companyShort, input.company.short.toUpperCase()],
    ...src.regions.map((r, i): [string, string] => [r, input.regions[i]?.trim() || r]),
  ];
  for (const [from, to] of pairs.filter(([f, t]) => f && t && f !== t).sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(new RegExp(`\\b${esc(from)}\\b`, 'g'), to);
  }
  return out;
}

/** Draft files from a source pack's files (relative path → text). */
export function draftPack(files: Record<string, string>, input: DraftInput): Record<string, string> {
  const manifestText = files['pack.yaml'];
  if (!manifestText) throw new DraftError('The source pack has no pack.yaml');
  const m = parse(manifestText) as Record<string, unknown> & { code: string; company: { name: string; short: string; hq: string }; database: string; regions: string[]; lint_terms?: string[] };
  const src: Source = { id: String(m.id), code: m.code, companyName: m.company.name, companyShort: m.company.short, hq: m.company.hq, database: m.database, regions: m.regions };
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) {
    if (path === 'golden.json' || path === 'pack.yaml') continue;
    out[path] = reskin(text, src, input);
  }
  const manifest = parse(reskin(manifestText, src, input)) as Record<string, unknown> & { company: Record<string, string>; lint_terms?: string[] };
  manifest.id = input.id;
  manifest.name = input.name;
  manifest.code = input.code;
  manifest.industry = input.industry;
  manifest.depth = 'draft';
  manifest.company = { ...manifest.company, name: input.company.name, short: input.company.short.toUpperCase(), hq: input.company.hq, description: input.company.description };
  manifest.version = '0.1.0';
  // The new company's names join the domain-string lint; the source's industry terms carry over.
  manifest.lint_terms = [...new Set([input.company.name.split(' ')[0] ?? input.company.name, input.company.hq, ...(manifest.lint_terms ?? [])])];
  out['pack.yaml'] = `# Draft pack — re-skinned from ${String(m.id)} by the Pack Drafter. Review every section before use.\n${stringify(manifest, { lineWidth: 0 })}`;
  return out;
}
