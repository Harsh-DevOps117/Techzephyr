import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/manifest.json", headers: [{ key: "Cache-Control", value: "no-cache" }] }
    ];
  },
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://localhost:3000"}/:path*` }];
  }
};
export default nextConfig;
