// Dev helper: schema-check one pack file. Usage: tsx scripts/_dev_parse.ts <file> <SchemaExportName>
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import * as S from '../src/lib/packs/schema';
import { splitFrontMatter } from '../src/lib/packs/loader';
const [file, name] = process.argv.slice(2) as [string, string];
const schema = (S as unknown as Record<string, { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: unknown[]; message: string }[] } } }>)[name];
if (!schema) throw new Error(`no schema ${name}`);
const text = readFileSync(file, 'utf8');
const value = file.endsWith('.md') ? splitFrontMatter(text).data : parse(text);
const r = schema.safeParse(value);
if (r.success) console.log(`OK ${file}`);
else { for (const i of r.error?.issues ?? []) console.log(`${file} ${i.path.join('.')}: ${i.message}`); process.exit(1); }
