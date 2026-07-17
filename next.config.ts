import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile exists in the parent directory).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
