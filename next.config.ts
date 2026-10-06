import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // No next/image in the app: skip the optimizer and keep sharp's native binaries out of the image.
  images: { unoptimized: true },
  // Native modules stay outside the server bundle.
  serverExternalPackages: ['@duckdb/node-api', '@duckdb/node-bindings'],
  // The build lints the app; `pnpm lint` covers scripts and tests too.
  eslint: { dirs: ['src'] },
  // Runtime data (app DB, warehouses, snapshots) lives in a volume, never in the server bundle; musl builds of
  // native modules are not needed on the glibc runtime image.
  outputFileTracingExcludes: {
    '*': ['data/**', 'tests/**', 'test-results/**', 'playwright-report/**', 'docs/**', '**/@duckdb+node-bindings-linux-x64-musl*/**', '**/@img+sharp*/**', '**/typescript@*/**'],
  },
};

export default nextConfig;
