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
  // native modules and sharp are not needed on the glibc runtime image. Next matches these patterns as
  // substrings, so runtime data is excluded by file extension: a 'data/**' pattern also drops
  // next/dist/lib/metadata/ and the server fails to start.
  outputFileTracingExcludes: {
    '*': ['**/*.duckdb', '**/*.duckdb.wal', '**/*.duckdb.meta.json', '**/*.db', '**/*.db-journal', '**/test-results/**', '**/playwright-report/**', '**/@duckdb+node-bindings-linux-x64-musl*/**', '**/@img+sharp*/**', '**/node_modules/typescript/**'],
  },
};

export default nextConfig;
