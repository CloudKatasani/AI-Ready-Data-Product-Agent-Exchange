import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { signPersona, verifyPersona } from '@/lib/presenter/session';

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));

describe('security — persona cookie tampering', () => {
  const secret = 'test-secret-0123456789';
  const good = signPersona('utilities:coo', secret);
  it('accepts only an intact signature under the server secret', () => {
    expect(verifyPersona(good, secret)).toBe('utilities:coo');
    expect(verifyPersona(good, 'another-secret')).toBeNull();
    expect(verifyPersona(good.replace('utilities:coo', 'utilities:customer-steward'), secret)).toBeNull();
    expect(verifyPersona(`${good}x`, secret)).toBeNull();
    expect(verifyPersona('utilities:coo', secret)).toBeNull();
    expect(verifyPersona('', secret)).toBeNull();
    expect(verifyPersona(undefined, secret)).toBeNull();
  });
});

describe('security — no secrets in source, packs or docs', () => {
  it('no API-key-shaped literal is committed anywhere outside tests', () => {
    const roots = ['src', 'packs', 'docs', 'scripts', 'prisma'].map((d) => join(process.cwd(), d));
    const hits = roots.flatMap(files).filter((f) => /\.(ts|tsx|ya?ml|md|json|sql|prisma)$/.test(f) && /sk-ant-[A-Za-z0-9_-]{8,}/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
