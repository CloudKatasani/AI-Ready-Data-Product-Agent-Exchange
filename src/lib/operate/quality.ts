/**
 * Agent Quality (01 §M10): feedback inbox → fix (synonym, business rule, verified query, instruction) →
 * versioned KnowledgeOverlay → the live pack reads overlays, so the next answer and the next eval see the
 * fix. The scorecard number for the pack's quality-fix agent is calibrated by the pack (ADR-0019).
 */
import type { PrismaClient } from '@prisma/client';
import type { AgentAnswer } from '@/lib/agents/types';
import { appendAudit } from '@/lib/db/audit';
import { type AgentManifest, BusinessRule, Instruction, type Pack, Synonym, VerifiedQuery } from '@/lib/packs/schema';

export type FixType = NonNullable<AgentManifest['quality_fix']>['fix']['type'];
export type OverlayKind = 'SYNONYM' | 'BUSINESS_RULE' | 'VERIFIED_QUERY' | 'INSTRUCTION';

export const OVERLAY_KIND: Record<FixType, OverlayKind> = { synonym: 'SYNONYM', business_rule: 'BUSINESS_RULE', verified_query: 'VERIFIED_QUERY', instruction: 'INSTRUCTION' };

export interface OverlayRow {
  kind: string;
  key: string;
  payloadJson: string;
}

const parse = (row: OverlayRow): unknown => {
  try {
    return JSON.parse(row.payloadJson);
  } catch {
    return null;
  }
};

/**
 * The pack with active knowledge overlays applied. Invalid payloads are ignored (they were validated when
 * written). A certification fix's `{ status: 'active' }` overlay activates a pending verified query.
 */
export function applyOverlays(pack: Pack, rows: OverlayRow[]): Pack {
  if (!rows.length) return pack;
  let { synonyms, rules, verifiedQueries, instructions } = pack;
  for (const row of rows) {
    const payload = parse(row);
    if (row.kind === 'SYNONYM') {
      const s = Synonym.safeParse(payload);
      if (s.success) synonyms = [...synonyms.filter((x) => x.term !== s.data.term), s.data];
    } else if (row.kind === 'BUSINESS_RULE') {
      const r = BusinessRule.safeParse(payload);
      if (r.success) rules = [...rules.filter((x) => x.id !== r.data.id), r.data];
    } else if (row.kind === 'VERIFIED_QUERY') {
      const v = VerifiedQuery.safeParse(payload);
      if (v.success) verifiedQueries = [...verifiedQueries.filter((x) => x.id !== v.data.id), v.data];
      else if ((payload as { status?: string } | null)?.status === 'active') verifiedQueries = verifiedQueries.map((x) => (x.id === row.key ? { ...x, status: 'active' as const } : x));
    } else if (row.kind === 'INSTRUCTION') {
      const i = Instruction.safeParse(payload);
      if (i.success) instructions = [...instructions.filter((x) => x.id !== i.data.id), i.data];
    }
  }
  return { ...pack, synonyms, rules, verifiedQueries, instructions };
}

/** Overlay key for a fix payload (the thing a later fix of the same kind would supersede). */
export function overlayKey(type: FixType, payload: Record<string, unknown>): string {
  const k = type === 'synonym' ? payload.term : payload.id;
  if (typeof k !== 'string' || !k) throw new Error(`A ${type} fix needs ${type === 'synonym' ? 'a term' : 'an id'}.`);
  return k;
}

/** Validates a fix payload against the pack schema for its type. */
export function validateFix(type: FixType, payload: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  const schema = { synonym: Synonym, business_rule: BusinessRule, verified_query: VerifiedQuery, instruction: Instruction }[type];
  const r = schema.safeParse(payload);
  return r.success ? { ok: true } : { ok: false, reason: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
}

/** Writes a versioned overlay (superseding the previous version of the same key) and audits it. */
export async function writeOverlay(client: PrismaClient, packId: string, type: FixType, payload: Record<string, unknown>, personaId: string, feedbackId: string | null): Promise<{ id: string; version: number }> {
  const v = validateFix(type, payload);
  if (!v.ok) throw new Error(`Invalid ${type} fix — ${v.reason}`);
  const kind = OVERLAY_KIND[type];
  const key = overlayKey(type, payload);
  const prev = await client.knowledgeOverlay.findFirst({ where: { packId, kind, key, supersededAt: null }, orderBy: { version: 'desc' } });
  const version = (prev?.version ?? 0) + 1;
  const row = await client.knowledgeOverlay.create({ data: { packId, kind, key, payloadJson: JSON.stringify(payload), version, createdBy: personaId, sourceFeedbackId: feedbackId } });
  if (prev) await client.knowledgeOverlay.update({ where: { id: prev.id }, data: { supersededAt: row.createdAt } });
  await appendAudit(client, { packId, actorType: 'HUMAN', actorId: personaId, action: 'KNOWLEDGE_OVERLAY_WRITTEN', subjectType: 'KNOWLEDGE_OVERLAY', subjectId: row.id, detail: { kind, key, version, feedbackId } });
  return { id: row.id, version };
}

/** Does the answer show the fix worked? (the feedback question now resolves to the fix's metric / query). */
export function fixResolves(answer: AgentAnswer, type: FixType, payload: Record<string, unknown>): boolean {
  if (answer.kind !== 'answer' || !answer.metricQuery) return false;
  const metrics = answer.metricQuery.metrics;
  if (type === 'synonym') {
    const to = payload.maps_to as { kind?: string; ref?: string } | undefined;
    return to?.kind !== 'metric' || metrics.includes(to.ref ?? '');
  }
  if (type === 'verified_query') {
    const q = (payload.query as { metrics?: string[] } | undefined)?.metrics ?? [];
    return q.some((m) => metrics.includes(m));
  }
  if (type === 'business_rule') return answer.rules.includes(String(payload.id));
  return true;
}

/**
 * Scorecard percentage. The pack's quality-fix agent shows its calibrated before/after numbers, and the
 * "after" number only once the fix demonstrably resolves the feedback question. Every other agent shows
 * its measured harness score.
 */
export function qualityScorePct(agent: AgentManifest, harnessOverall: number | null, feedbackResolved: boolean | null): number | null {
  if (agent.quality_fix && feedbackResolved !== null) return feedbackResolved ? agent.quality_fix.eval_after_pct : agent.quality_fix.eval_before_pct;
  return harnessOverall === null ? null : Math.round(harnessOverall * 1000) / 10;
}
