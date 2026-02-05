import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["@sea-of-gold/engine", "@sea-of-gold/shared"],
};

export default nextConfig;
