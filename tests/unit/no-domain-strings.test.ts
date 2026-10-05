import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/no-domain-strings';

describe('no-domain-strings scanner', () => {
  const dir = mkdtempSync(join(tmpdir(), 'keystone-lint-'));
  const file = join(dir, 'fixture.tsx');
  writeFileSync(file, 'const a = 1;\nconst title = "Acme Widgets quarterly";\n');

  it('finds a planted term with its line number, case-insensitively', () => {
    const v = scan(['acme widgets'], [file]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ line: 2, term: 'Acme Widgets' });
  });

  it('matches whole words only and ignores very short terms', () => {
    expect(scan(['Widget', 'a'], [file])).toHaveLength(0);
  });

  it('passes with no terms', () => {
    expect(scan([], [file])).toEqual([]);
  });
});
