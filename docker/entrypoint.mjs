// Container entrypoint (the runtime image is distroless, so there is no shell).
// 1. First start: initialise the data volume from the image template. The seeded app DB ships gzipped;
//    warehouses are copied when the image was built with PREBUILD=deep.
// 2. Point Prisma at its query engine explicitly, so engine detection never depends on shell tools.
// 3. Start the Next standalone server.
// SESSION_SECRET must be provided: production refuses the default (invariant I11).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const app = '/app';
const data = join(app, 'data');
const template = join(app, 'template-data');

if (!existsSync(join(data, 'keystone.db'))) {
  mkdirSync(data, { recursive: true });
  for (const entry of readdirSync(template)) {
    if (entry !== 'keystone.db.gz') cpSync(join(template, entry), join(data, entry), { recursive: true });
  }
  // Write to a temp name first: an interrupted first start must not leave a truncated DB behind.
  const tmp = join(data, 'keystone.db.init');
  writeFileSync(tmp, gunzipSync(readFileSync(join(template, 'keystone.db.gz'))));
  renameSync(tmp, join(data, 'keystone.db'));
  console.log('keystone: data volume initialised from the image template');
}

if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const pnpm = join(app, 'node_modules', '.pnpm');
  for (const dir of existsSync(pnpm) ? readdirSync(pnpm).filter((d) => d.startsWith('@prisma+client@')) : []) {
    const client = join(pnpm, dir, 'node_modules', '.prisma', 'client');
    const engine = existsSync(client) ? readdirSync(client).find((f) => /^libquery_engine-.*\.so\.node$/.test(f)) : undefined;
    if (engine) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = join(client, engine);
      break;
    }
  }
}

await import(join(app, 'server.js'));
