/** pnpm db:seed — seeds personas and entitlements for every installed pack. */
import { db } from '../src/lib/db';
import { getPack, listPackIds } from '../src/lib/packs/registry';
import { seedPack } from '../src/lib/presenter/seed';

const prisma = db();
for (const id of listPackIds()) {
  const r = await seedPack(prisma, getPack(id));
  console.log(`${id}: ${r.personas} personas, ${r.entitlements} entitlements`);
}
await prisma.$disconnect();
