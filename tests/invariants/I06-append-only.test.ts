import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { auditHash, canonicalJson, verifyChain } from '@/lib/db/audit';
import { contentHash } from '@/lib/lifecycle/engine';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}
const SRC = files(join(process.cwd(), 'src')).map((f) => ({ file: relative(process.cwd(), f), text: readFileSync(f, 'utf8') }));
/** Seeding is a reset of the pack's demo state (snapshot restore replaces it in Phase 9); nothing else deletes. */
const RESET = 'src/lib/presenter/seed.ts';

// CLAUDE.md §4.6 — Append-only history.
describe('I06 append-only history', () => {
  it.each(['auditEvent', 'agentAction', 'artifactVersion', 'queryLog', 'answerRecord', 'gateEvidence', 'decision', 'fieldProvenance'])('%s exposes no update or delete path', (model) => {
    const offenders = SRC.filter((f) => f.file !== RESET && new RegExp(`\\.${model}\\.(update|updateMany|upsert|delete|deleteMany)\\(`).test(f.text)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it('nothing in the app hard-deletes a row (soft state changes only)', () => {
    const offenders = SRC.filter((f) => f.file !== RESET && /\.(delete|deleteMany)\(\{/.test(f.text) && /prisma|client|tx|db\(\)/.test(f.text)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it('ArtifactVersion rows are content-hashed and the hash verifies', async () => {
    const versions = await db().artifactVersion.findMany({ take: 200 });
    expect(versions.length).toBeGreaterThan(50);
    for (const v of versions) expect(contentHash(JSON.parse(v.contentJson) as Record<string, unknown>)).toBe(v.contentHash);
  });

  it('the audit hash chain verifies, and detects a tampered row', async () => {
    const events = await db().auditEvent.findMany({ where: { packId: 'utilities' } });
    expect(verifyChain(events).ok).toBe(true);
    const tampered = events.map((e, i) => (i === Math.floor(events.length / 2) ? { ...e, detailJson: canonicalJson({ tampered: true }) } : e));
    expect(verifyChain(tampered).ok).toBe(false);
    const e = events[0];
    if (e) expect(auditHash(null, { packId: e.packId, actorType: 'SYSTEM', actorId: 'x', action: 'y', subjectType: 'z', subjectId: 'w', detail: {} })).toHaveLength(64);
  });
});
