'use server';

import { getPack, hasPack } from '@/lib/packs/registry';
import { type GovernedOutcome, governedQuery } from '@/lib/presenter/governed';
import { activePrincipal } from '../../_server/session';

/** Runs worksheet SQL for the active persona through QueryService (sql-safety + policies). */
export async function runWorksheet(packId: string, sql: string): Promise<GovernedOutcome> {
  if (!hasPack(packId)) return { ok: false, kind: 'unavailable', message: 'Unknown pack.' };
  const pack = getPack(packId);
  return governedQuery(packId, { kind: 'sql', sql, source: 'worksheet' }, await activePrincipal(pack));
}
