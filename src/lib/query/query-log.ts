import type { PrismaClient } from '@prisma/client';
import type { QueryLogEntry, QueryLogSink } from './query-service';

/** QueryLog rows in the app database (append-only). */
export function prismaQueryLog(prisma: PrismaClient): QueryLogSink {
  return {
    async write(e: QueryLogEntry): Promise<string> {
      const row = await prisma.queryLog.create({
        data: {
          personaId: e.personaId,
          kind: e.kind,
          purpose: e.purpose,
          sqlHash: e.sqlHash,
          displaySql: e.displaySql,
          productIdsJson: JSON.stringify(e.productIds),
          policiesJson: JSON.stringify(e.policies),
          rowCount: e.rowCount,
          elapsedMs: e.elapsedMs,
        },
      });
      return row.id;
    },
  };
}
