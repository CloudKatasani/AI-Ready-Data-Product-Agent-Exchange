import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/{unit,invariants,golden,integration}/**/*.test.ts'],
    globalSetup: ['tests/setup/global.ts'],
    testTimeout: 30_000,
    // Dedicated, freshly migrated and seeded app DB (tests/setup/global.ts).
    env: { DATABASE_URL: 'file:../data/test-app.db', WAREHOUSE_DIR: './data/test-warehouse' },
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
    },
  },
});
