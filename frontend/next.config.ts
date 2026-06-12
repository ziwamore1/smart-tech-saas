import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  output: 'standalone',

  images: {
    domains: [
      'res.cloudinary.com',
    ],
  },

  compress: true,

  poweredByHeader: false,
};

export default nextConfig;
