import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { dirs: ['src', 'scripts', 'tests'] },
};

export default nextConfig;
