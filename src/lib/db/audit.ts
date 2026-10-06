import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

/** A client or an interactive-transaction client. */
export type Db = PrismaClient | Prisma.TransactionClient;

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
export async function appendAudit(prisma: Db, e: AuditInput): Promise<string> {
  const prev = await prisma.auditEvent.findFirst({ where: { packId: e.packId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { hash: true } });
  const hash = auditHash(prev?.hash ?? null, e);
  const row = await prisma.auditEvent.create({
    data: { packId: e.packId, actorType: e.actorType, actorId: e.actorId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, detailJson: canonicalJson(e.detail), hash, prevHash: prev?.hash ?? null },
  });
  return row.id;
}

export interface ChainCheck {
  ok: boolean;
  events: number;
  brokenAt?: string;
}

export interface StoredAuditEvent {
  id: string;
  packId: string;
  actorType: string;
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  detailJson: string;
  hash: string;
  prevHash: string | null;
}

/** Orders events by following prevHash links from the genesis event (null on a fork or a gap). */
export function chainOrder<E extends StoredAuditEvent>(events: E[]): E[] | null {
  const byPrev = new Map<string, E[]>();
  for (const e of events) byPrev.set(e.prevHash ?? '', [...(byPrev.get(e.prevHash ?? '') ?? []), e]);
  const out: E[] = [];
  let key = '';
  for (;;) {
    const next = byPrev.get(key);
    if (!next) break;
    if (next.length > 1) return null;
    const e = next[0] as E;
    out.push(e);
    key = e.hash;
  }
  return out.length === events.length ? out : null;
}

/** Verifies the chain: each hash = sha256(prevHash + canonicalJson(event)) and every event links to its predecessor. */
export function verifyChain(events: StoredAuditEvent[]): ChainCheck {
  const ordered = chainOrder(events);
  if (!ordered) return { ok: false, events: events.length, brokenAt: 'chain links (fork or gap)' };
  let prev: string | null = null;
  for (const e of ordered) {
    const input: AuditInput = { packId: e.packId, actorType: e.actorType as AuditInput['actorType'], actorId: e.actorId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, detail: JSON.parse(e.detailJson) as unknown };
    if (e.prevHash !== prev || auditHash(prev, input) !== e.hash) return { ok: false, events: events.length, brokenAt: e.id };
    prev = e.hash;
  }
  return { ok: true, events: events.length };
}
