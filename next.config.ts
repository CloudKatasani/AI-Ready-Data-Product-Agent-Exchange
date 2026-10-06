import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Native modules stay outside the server bundle.
  serverExternalPackages: ['@duckdb/node-api', '@duckdb/node-bindings'],
  eslint: { dirs: ['src', 'scripts', 'tests'] },
};

export default nextConfig;
