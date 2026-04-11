import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/login',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },

  allowedDevOrigins: ['192.168.88.169'],
  // // Enable React Strict Mode for development
  // reactStrictMode: true,

  // // Optimize images
  // images: {
  //   domains: ['cdn.discordapp.com', 'avatars.githubusercontent.com'],
  //   formats: ['image/webp', 'image/avif'],
  // },

  // // Enable SWC minification
  // swcMinify: true,

  // // Experimental features
  // experimental: {
  //   // Enable app directory
  //   appDir: true,
  //   // Enable server components
  //   serverComponentsExternalPackages: [],
  // },

  // // Webpack configuration
  // webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
  //   // Add support for importing SVG as React components
  //   config.module.rules.push({
  //     test: /\.svg$/,
  //     use: ['@svgr/webpack'],
  //   });

  //   return config;
  // },

  // // Security headers
  // async headers() {
  //   return [
  //     {
  //       source: '/(.*)',
  //       headers: [
  //         {
  //           key: 'X-Frame-Options',
  //           value: 'DENY',
  //         },
  //         {
  //           key: 'X-Content-Type-Options',
  //           value: 'nosniff',
  //         },
  //         {
  //           key: 'Referrer-Policy',
  //           value: 'strict-origin-when-cross-origin',
  //         },
  //         {
  //           key: 'Permissions-Policy',
  //           value: 'camera=(), microphone=(), geolocation=()',
  //         },
  //       ],
  //     },
  //   ];
  // },

  // // Content Security Policy (development mode)
  // async headers() {
  //   if (process.env.NODE_ENV === 'development') {
  //     return [];
  //   }

  //   return [
  //     {
  //       source: '/(.*)',
  //       headers: [
  //         {
  //           key: 'Content-Security-Policy',
  //           value: `
  //             default-src 'self';
  //             script-src 'self' 'unsafe-eval' 'unsafe-inline';
  //             style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  //             img-src 'self' data: https: blob:;
  //             font-src 'self' https://fonts.gstatic.com;
  //             connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL} ${process.env.NEXT_PUBLIC_WS_URL};
  //             frame-ancestors 'none';
  //           `.replace(/\s{2,}/g, ' ').trim(),
  //         },
  //       ],
  //     },
  //   ];
  // },

  // // Environment variables
  // env: {
  //   CUSTOM_KEY: 'my-value',
  // },

  // // TypeScript configuration
  // typescript: {
  //   // Type checking is handled by the build process
  //   ignoreBuildErrors: false,
  // },

  // // ESLint configuration
  // eslint: {
  //   // ESLint is handled by the build process
  //   ignoreDuringBuilds: false,
  // },
};

export default withNextIntl(nextConfig);
