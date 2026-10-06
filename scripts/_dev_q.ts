import { openWarehouseReadOnly } from '../src/lib/warehouse/build';
const w = await openWarehouseReadOnly(process.argv[2] as string);
for (const q of process.argv.slice(3)) console.log(JSON.stringify((await w.query(q)).rows));
await w.close();
