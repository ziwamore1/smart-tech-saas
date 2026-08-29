import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Next's standalone copier cannot create traced chunk names containing `:`
  // on Windows (for example, the node:inspector external). Keep standalone
  // output for Linux deployment builds while allowing local Windows builds.
  output: process.env.SKIP_STANDALONE || process.platform === 'win32' ? undefined : 'standalone',

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
