/**
 * Server-side marketplace state: live product records, latest quality snapshots and pending requests from
 * the app DB, merged with the pack. Falls back to pack values when the DB is unavailable.
 */
import { db } from '@/lib/db';
import { type CatalogState, type LiveProduct, type ProductStatus, type QualityView } from '@/lib/marketplace/catalog';
import type { Pack } from '@/lib/packs/schema';

export async function catalogState(pack: Pack, personaId: string): Promise<CatalogState> {
  const live = new Map<string, LiveProduct>();
  const quality = new Map<string, QualityView>();
  const pendingProducts = new Set<string>();
  const degraded = new Set<string>();
  try {
    const prisma = db();
    const rows = await prisma.dataProduct.findMany({ where: { packId: pack.manifest.id }, select: { id: true, status: true, semanticVersion: true, currentStage: true, tier: true } });
    for (const r of rows) live.set(r.id, { status: r.status as ProductStatus, version: r.semanticVersion, stage: r.currentStage });
    const snaps = await prisma.qualityScoreSnapshot.findMany({ where: { productId: { in: rows.map((r) => r.id) } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const tiers = new Map(rows.map((r) => [r.id, r.tier]));
    for (const s of snaps) if (!quality.has(s.productId)) quality.set(s.productId, { score: s.score, tier: tiers.get(s.productId) ?? 'unrated', at: s.createdAt.toISOString() });
    const pending = await prisma.accessRequest.findMany({ where: { packId: pack.manifest.id, requesterId: personaId, state: 'PENDING' }, select: { productId: true } });
    for (const p of pending) if (p.productId) pendingProducts.add(p.productId);
    const open = await prisma.incident.findMany({ where: { packId: pack.manifest.id, state: { not: 'RESOLVED' } }, select: { templateId: true } });
    for (const i of open) for (const id of pack.incidents.find((t) => t.id === i.templateId)?.affects.products ?? []) degraded.add(id);
  } catch {
    // Pack-only view (DB not migrated yet).
  }
  return { live, quality, pendingProducts, degraded };
}

export async function qualityHistory(productId: string): Promise<{ score: number; at: string; dimensions: Record<string, { passRate: number; rules: number }> }[]> {
  try {
    const rows = await db().qualityScoreSnapshot.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({ score: r.score, at: r.createdAt.toISOString(), dimensions: JSON.parse(r.dimensionsJson) as Record<string, { passRate: number; rules: number }> }));
  } catch {
    return [];
  }
}

/** Latest result per rule across products (a rule on a shared Gold table is evaluated for each product using it). */
export async function latestResultsForRules(ruleIds: string[]) {
  if (!ruleIds.length) return [];
  try {
    const rows = await db().qualityRuleResult.findMany({ where: { ruleId: { in: ruleIds } }, orderBy: { evaluatedAt: 'desc' } });
    const seen = new Set<string>();
    return rows.filter((r) => !seen.has(r.ruleId) && seen.add(r.ruleId));
  } catch {
    return [];
  }
}

export async function latestRuleResults(productId: string) {
  try {
    const rows = await db().qualityRuleResult.findMany({ where: { productId }, orderBy: { evaluatedAt: 'desc' } });
    const seen = new Set<string>();
    return rows.filter((r) => !seen.has(r.ruleId) && seen.add(r.ruleId));
  } catch {
    return [];
  }
}
