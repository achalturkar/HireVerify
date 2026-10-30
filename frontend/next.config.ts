import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_PROXY_TARGET || 'http://127.0.0.1:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${target}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${target}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
