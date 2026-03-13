import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tối ưu hình ảnh
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // Cache 24h
  },

  // Nén response
  compress: true,

  // Strict mode cho React
  reactStrictMode: true,

  // Cache headers cho tài nguyên tĩnh
  headers: async () => [
    {
      source: '/:all*(svg|jpg|png|webp|avif|woff2)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    {
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ],
};

export default nextConfig;
