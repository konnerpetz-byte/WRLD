import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Points wallet and Points flights became one Points explorer.
  async redirects() {
    return [
      { source: "/wallet", destination: "/points/wallet", permanent: true },
      { source: "/flights", destination: "/points", permanent: true },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
