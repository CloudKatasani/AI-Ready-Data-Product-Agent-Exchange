/**
 * Server-side entry point screens use to read warehouse data — always through QueryService.
 * Returns a serialisable outcome so screens can render denials and rejections calmly (07 §6).
 */
import { db } from '@/lib/db';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { CompileError } from '@/lib/query/compiler';
import { warehouseFor, WarehouseMissing } from '@/lib/query/connections';
import { principalFor } from '@/lib/query/principal';
import { prismaQueryLog } from '@/lib/query/query-log';
import { QueryService, SqlRejected } from '@/lib/query/query-service';
import { type GovernedResult, PolicyDenied, type Principal, type QueryRequest } from '@/lib/query/types';

export type GovernedOutcome =
  | { ok: true; result: GovernedResult }
  | { ok: false; kind: 'denied'; message: string; productId: string | null; requestable: boolean }
  | { ok: false; kind: 'rejected'; message: string; hint: string }
  | { ok: false; kind: 'unavailable'; message: string };

/** Live entitlements from the app DB; falls back to the pack's seed grants if the DB is unavailable. */
export async function principalForPersona(packId: string, personaId: string): Promise<Principal> {
  const pack = getPack(packId);
  try {
    // Expiry is judged against the pack clock, never the wall clock.
    const asOf = new Date(`${pack.manifest.asOf}T23:59:59Z`);
    const rows = await db().entitlement.findMany({ where: { personaId, subjectType: 'PRODUCT', revokedAt: null } });
    const live = rows.filter((r) => !r.expiresAt || r.expiresAt >= asOf).map((r) => r.subjectId);
    return principalFor(pack, personaId, rows.length ? live : undefined);
  } catch {
    return principalFor(pack, personaId);
  }
}

export async function governedService(packId: string): Promise<QueryService> {
  return new QueryService({ pack: getPack(packId), rubrics: getRubrics(), warehouse: await warehouseFor(packId), log: prismaQueryLog(db()) });
}

/** Catalog metadata for Explorer (objects and columns; no rows). Empty when the warehouse is not built. */
export async function warehouseCatalog(packId: string): Promise<Awaited<ReturnType<QueryService['catalog']>>> {
  try {
    return await (await governedService(packId)).catalog();
  } catch {
    return [];
  }
}

export async function describeObject(packId: string, fqn: string): Promise<{ name: string; type: string; nullable: boolean }[]> {
  try {
    return await (await governedService(packId)).describe(fqn);
  } catch {
    return [];
  }
}

/** Recent governed queries touching an object or product (Explorer governance tab, Audit). */
export async function accessHistory(needle: string, limit = 15): Promise<{ id: string; personaId: string; kind: string; purpose: string | null; rowCount: number; createdAt: string }[]> {
  try {
    const rows = await db().queryLog.findMany({
      where: { OR: [{ displaySql: { contains: needle } }, { productIdsJson: { contains: needle } }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({ id: r.id, personaId: r.personaId, kind: r.kind, purpose: r.purpose, rowCount: r.rowCount, createdAt: r.createdAt.toISOString() }));
  } catch {
    return [];
  }
}

export async function governedQuery(packId: string, req: QueryRequest, who: Principal): Promise<GovernedOutcome> {
  try {
    return { ok: true, result: await (await governedService(packId)).run(req, who) };
  } catch (e) {
    if (e instanceof PolicyDenied) return { ok: false, kind: 'denied', message: e.message, productId: e.productId, requestable: e.requestable };
    if (e instanceof SqlRejected) return { ok: false, kind: 'rejected', message: e.message, hint: e.hint };
    if (e instanceof CompileError) return { ok: false, kind: 'rejected', message: e.message, hint: e.suggestions.length ? `Did you mean ${e.suggestions.join(', ')}?` : 'Check the metric and dimension names.' };
    if (e instanceof WarehouseMissing) return { ok: false, kind: 'unavailable', message: e.message };
    return { ok: false, kind: 'unavailable', message: e instanceof Error ? e.message : 'The query could not run.' };
  }
}
