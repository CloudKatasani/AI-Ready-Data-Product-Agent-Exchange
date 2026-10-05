import { assertStartupConfig, getEnv } from '@/lib/config/env';

/** Next.js startup hook: fail fast on unsafe configuration. */
export function register(): void {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    assertStartupConfig(getEnv());
  }
}
