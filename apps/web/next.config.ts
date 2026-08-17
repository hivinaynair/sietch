import { resolve } from "node:path";
import type { NextConfig } from "next";
import "./src/env";

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  outputFileTracingIncludes: {
    "/api/clip/advance": ["../../artifacts/demo/*.groth16.json"],
  },
  serverExternalPackages: ["@coinbase/cdp-sdk"],
  transpilePackages: ["@repo/ui", "@splinetool/react-spline", "@splinetool/runtime"],
};

export default nextConfig;
