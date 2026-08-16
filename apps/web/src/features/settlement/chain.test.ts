import { expect, test } from "bun:test";
import { CLIP_TX, DEPLOY_TX, shortHash, txUrl } from "./chain";
import { DESK, TBILL, VERIFIER_GATEWAY } from "./settlement";

/**
 * artifacts/demo/chain.json is written by the operator scripts; the room only mirrors it.
 * Re-running the clip must not be able to leave stale hashes on a page that invites the
 * reader to open them.
 */
const artifact = await Bun.file(
  new URL("../../../../../artifacts/demo/chain.json", import.meta.url),
).json();

test("clip transactions match the committed artifact", () => {
  expect(CLIP_TX.settlePending).toBe(artifact.clip.settlePending);
  expect(CLIP_TX.publishInboundV2).toBe(artifact.clip.publishInboundV2);
  expect(CLIP_TX.settleForPaul).toBe(artifact.clip.settleForPaul);
});

test("deploy transactions match the committed artifact", () => {
  expect(DEPLOY_TX.tbill).toBe(artifact.deploy.tbill);
  expect(DEPLOY_TX.desk).toBe(artifact.deploy.desk);
  expect(DEPLOY_TX.mint).toBe(artifact.deploy.mint);
});

test("addresses on the page match the committed artifact", () => {
  expect(DESK).toBe(artifact.desk);
  expect(TBILL).toBe(artifact.tbill);
  expect(VERIFIER_GATEWAY).toBe(artifact.gateway);
});

test("every hash the room links is a whole hash", () => {
  for (const hash of [...Object.values(CLIP_TX), ...Object.values(DEPLOY_TX)]) {
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  }
});

test("links resolve to the network the header claims", () => {
  expect(artifact.chainId).toBe(84532);
  expect(txUrl(CLIP_TX.settleForPaul)).toBe(
    `https://sepolia.basescan.org/tx/${CLIP_TX.settleForPaul}`,
  );
});

test("the short form is display only and never replaces the link target", () => {
  expect(shortHash(CLIP_TX.settlePending)).toBe("0xc445…8198");
  expect(txUrl(CLIP_TX.settlePending)).toContain(CLIP_TX.settlePending);
});
