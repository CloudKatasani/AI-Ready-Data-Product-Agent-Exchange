import { openWarehouseReadOnly, tableChecksums } from '../src/lib/warehouse/build';
const w = await openWarehouseReadOnly(process.argv[2] as string);
console.log(JSON.stringify(await tableChecksums(w)));
await w.close();
