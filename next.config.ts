import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // NOTE: `cacheComponents` (Next 16 Cache Components) is intentionally OFF.
  // It requires a fully-behaving setTimeout() which the Cloudflare Workers
  // runtime does not provide — enabling it hangs every route (error 1101).
  // Revisit when OpenNext/Next.js resolve the runtime timer support.
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
