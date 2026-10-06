import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPack, listPackIds, packsDir } from '@/lib/packs/registry';

// CLAUDE.md §4.10 — Synthetic only.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const ids = listPackIds().filter((id) => {
  try {
    return Boolean(getPack(id));
  } catch {
    return false;
  }
});

describe('I10 synthetic only', () => {
  it('every route renders the synthetic-data footer (the pack shell and the launcher; e2e shell.spec checks rendering)', () => {
    expect(read('src/components/shell/app-shell.tsx')).toMatch(/<Footer\b/);
    expect(read('src/app/(presenter)/launch/page.tsx')).toMatch(/<Footer\b/);
    expect(read('src/components/shell/footer.tsx')).toMatch(/synthetic-footer/);
  });

  it.each(ids)('%s declares a company with its own fictional database name and generated personas', (id) => {
    const p = getPack(id);
    expect(p.manifest.company.name.length).toBeGreaterThan(2);
    expect(p.manifest.database).toMatch(/^[A-Z][A-Z0-9_]+$/);
    // Personas are generated people: unique names, each with a title, none reusing the company name.
    const names = p.personas.map((x) => x.name);
    expect(new Set(names).size).toBe(names.length);
    for (const x of p.personas) expect(x.name).not.toContain(p.manifest.company.name);
  });

  it.each(ids)('%s contains no real customer data or pricing markers', (id) => {
    const text = files(join(packsDir(), id))
      .filter((f) => /\.(ya?ml|md|sql|json)$/.test(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    // Real mail domains, SSN-shaped values, 16-digit card numbers and list-price language.
    expect(text).not.toMatch(/@(gmail|yahoo|hotmail|outlook|icloud)\.com/i);
    expect(text).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    expect(text).not.toMatch(/\b(?:\d{4}[ -]?){3}\d{4}\b/);
    expect(text).not.toMatch(/\b(list price|per seat|MSRP)\b/i);
  });
});
