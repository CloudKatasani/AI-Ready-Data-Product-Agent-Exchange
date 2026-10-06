import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export interface AuditInput {
  packId: string;
  actorType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  detail: unknown;
}

/** Canonical JSON: keys sorted at every level, so the hash is independent of key order. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

export function auditHash(prevHash: string | null, e: AuditInput): string {
  return createHash('sha256').update(`${prevHash ?? ''}${canonicalJson(e)}`).digest('hex');
}

/** Appends a hash-chained AuditEvent (append-only, invariant I06). */
export async function appendAudit(prisma: PrismaClient, e: AuditInput): Promise<string> {
  const prev = await prisma.auditEvent.findFirst({ where: { packId: e.packId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { hash: true } });
  const hash = auditHash(prev?.hash ?? null, e);
  const row = await prisma.auditEvent.create({
    data: { packId: e.packId, actorType: e.actorType, actorId: e.actorId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, detailJson: canonicalJson(e.detail), hash, prevHash: prev?.hash ?? null },
  });
  return row.id;
}
