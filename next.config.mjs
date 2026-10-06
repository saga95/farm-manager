import { readFileSync } from 'node:fs';
import bundleAnalyzer from '@next/bundle-analyzer';
import { contentSecurityPolicy } from './security-headers.mjs';

/** Written by `ampx pipeline-deploy` before the build; a stub locally. */
function readAmplifyOutputs() {
  try {
    return JSON.parse(
      readFileSync(new URL('./amplify_outputs.json', import.meta.url), 'utf8')
    );
  } catch {
    return {};
  }
}
const amplifyOutputs = readAmplifyOutputs();

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// AWS Amplify Hosting build (AWS_APP_ID is set by Amplify). The Standard build
// container (8 GiB) ran out of memory during `next build`, so on Amplify:
// - lint and type-check are skipped (GitHub CI enforces both before any merge)
// - static generation and build tracing use a single worker
const isAmplifyBuild = Boolean(process.env.AWS_APP_ID);

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: true,

  // Exclude test files and directories from pages
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].map(ext => {
    return ext;
  }),

  // Performance optimizations
  swcMinify: true,
  compress: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  eslint: { ignoreDuringBuilds: isAmplifyBuild },
  typescript: { ignoreBuildErrors: isAmplifyBuild },

  // Experimental features for performance
  experimental: {
    ...(isAmplifyBuild ? { cpus: 1, workerThreads: false } : {}),
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      'recharts',
      'dayjs',
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          // Content Security Policy: AWS hosts from this deployment's outputs (#107)
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy(amplifyOutputs),
          },
          // Strict Transport Security
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // Webpack configuration for performance
  webpack: (config, { dev, isServer }) => {
    // SVG handling
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    // Performance optimizations
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
            common: {
              minChunks: 2,
              chunks: 'all',
              name: 'common',
              priority: 5,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }

    return config;
  },

  // Compiler options
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },

  // Power configuration
  poweredByHeader: false,

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.0.0',
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default withBundleAnalyzer(nextConfig);
