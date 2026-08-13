import { resolve } from "node:path";
import { withWorkflow } from "workflow/next";

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
};

export default withWorkflow(nextConfig);
