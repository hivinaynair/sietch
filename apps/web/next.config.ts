import { resolve } from "node:path";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import "./src/env";

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  outputFileTracingIncludes: {
    "/api/clip/advance": ["../../artifacts/demo/*.groth16.json"],
  },
  transpilePackages: ["@repo/ui", "@splinetool/react-spline", "@splinetool/runtime"],
};

export default withWorkflow(nextConfig);
