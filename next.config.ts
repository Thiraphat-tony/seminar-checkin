import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Optimize for Vercel Pro
  poweredByHeader: false,
  compress: true,

  // Keep Turbopack scoped to this repository.
  // Without this, Next.js may pick a parent directory when multiple lockfiles exist,
  // which makes local dev/build slower due to broader file watching.
  turbopack: {
    root: path.resolve(__dirname),
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },
  
  // Headers for static assets
  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
