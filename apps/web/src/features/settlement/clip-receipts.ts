/**
 * The four Groth16 blobs the desk verifies. Imported so the serverless bundle
 * carries them — `import.meta.dirname` is undefined on Vercel, and a join()
 * against that threw before the files were ever opened.
 */

import chaniOutbound from "../../../../../artifacts/demo/chani-outbound.groth16.json";
import chaniOutboundRetry from "../../../../../artifacts/demo/chani-outbound-retry.groth16.json";
import paulInboundV1 from "../../../../../artifacts/demo/paul-inbound-v1.groth16.json";
import paulInboundV2 from "../../../../../artifacts/demo/paul-inbound-v2.groth16.json";

export type Groth16File = { proof: string; publicValues: string };

const FILES = {
  "chani-outbound": chaniOutbound,
  "chani-outbound-retry": chaniOutboundRetry,
  "paul-inbound-v1": paulInboundV1,
  "paul-inbound-v2": paulInboundV2,
} as const;

export type ReceiptSlug = keyof typeof FILES;

export function groth16Receipt(slug: ReceiptSlug): Groth16File {
  const file = FILES[slug];
  return { proof: file.proof, publicValues: file.publicValues };
}
