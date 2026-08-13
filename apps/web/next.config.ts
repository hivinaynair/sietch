import { resolve } from "node:path";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import "./src/env.ts";

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@repo/ui"],
};

export default withWorkflow(nextConfig);
