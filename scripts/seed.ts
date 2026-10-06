/** pnpm db:seed — seeds every installed pack (quality snapshots need the pack's warehouse; skipped if not built). */
import { db } from '../src/lib/db';
import { getPack, getRubrics, listPackIds } from '../src/lib/packs/registry';
import { seedPack } from '../src/lib/presenter/seed';
import { closeWarehouses, warehouseFor } from '../src/lib/query/connections';
import { QueryService } from '../src/lib/query/query-service';

const prisma = db();
const rubrics = getRubrics();
for (const id of listPackIds()) {
  let pack;
  try {
    pack = getPack(id);
  } catch (e) {
    console.error(`${id}: skipped — the pack does not load (${(e as Error).message.split('\n')[0]}). Run pnpm pack:validate ${id}.`);
    continue;
  }
  let qs: QueryService | undefined;
  try {
    qs = new QueryService({ pack, rubrics, warehouse: await warehouseFor(id), log: { write: async () => 'seed' } });
  } catch {
    console.log(`${id}: warehouse not built — quality snapshots skipped (run pnpm warehouse:build first)`);
  }
  const r = await seedPack(prisma, pack, { rubrics, qs });
  console.log(`${id}: ${r.personas} personas, ${r.entitlements} entitlements, ${r.products} products, ${r.agents} agents, ${r.snapshots} quality snapshots`);
}
await closeWarehouses();
await prisma.$disconnect();
