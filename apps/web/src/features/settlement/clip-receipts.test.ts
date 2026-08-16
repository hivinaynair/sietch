import { expect, test } from "bun:test";
import { groth16Receipt, type ReceiptSlug } from "./clip-receipts";

const SLUGS: ReceiptSlug[] = [
  "chani-outbound",
  "chani-outbound-retry",
  "paul-inbound-v1",
  "paul-inbound-v2",
];

test("each clip receipt is bundled with a proof and public values", () => {
  for (const slug of SLUGS) {
    const receipt = groth16Receipt(slug);
    expect(receipt.proof.startsWith("0x")).toBe(true);
    expect(receipt.proof.length).toBeGreaterThan(80);
    expect(receipt.publicValues.startsWith("0x")).toBe(true);
  }
});
