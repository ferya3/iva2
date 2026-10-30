import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Trace workspace packages from the monorepo root into the standalone build.
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@cognitest/ui', '@cognitest/shared-types', '@cognitest/report-schema'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
