import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts', 'a11y/**/*.spec.ts', 'stories/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure', viewport: { width: 1920, height: 1080 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
  webServer: {
    // Warehouse build is cached by pack content hash; db:setup migrates and seeds (idempotent).
    command: `pnpm warehouse:build --pack utilities && pnpm db:setup && pnpm start --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // `next start` runs in production mode, which refuses the default secret (invariant I11).
    env: {
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-only-session-secret',
      // A planted key: tests/e2e/secrets.spec.ts asserts it never reaches the browser.
      ANTHROPIC_API_KEY: 'sk-ant-e2e-planted-0000000000000000',
    },
  },
});
