import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },

  compress: true,

  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
