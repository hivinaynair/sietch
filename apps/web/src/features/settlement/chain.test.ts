import { expect, test } from "bun:test";
import { CLIP_TX, DEPLOY_BLOCK, DEPLOY_TX, shortHash, txUrl } from "./chain";
import { DESK, TBILL, VERIFIER_GATEWAY } from "./settlement";

/**
 * artifacts/demo/chain.json is written by bun run rearm; the room imports it.
 * A spent walk must not leave another desk's hashes on a page that invites the
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
  expect(DEPLOY_BLOCK).toBe(artifact.deployBlock);
});

test("addresses on the page match the committed artifact", () => {
  expect(DESK).toBe(artifact.desk);
  expect(TBILL).toBe(artifact.tbill);
  expect(VERIFIER_GATEWAY).toBe(artifact.gateway);
});

test("every hash the room links is a whole hash", () => {
  for (const hash of [...Object.values(CLIP_TX), ...Object.values(DEPLOY_TX)].filter(Boolean)) {
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  }
});

test("links resolve to the network the header claims", () => {
  expect(artifact.chainId).toBe(84532);
  expect(txUrl(DEPLOY_TX.desk)).toBe(`https://sepolia.basescan.org/tx/${DEPLOY_TX.desk}`);
});

test("the short form is display only and never replaces the link target", () => {
  expect(shortHash(DEPLOY_TX.tbill)).toBe("0x4b19…40e5");
  expect(txUrl(DEPLOY_TX.tbill)).toContain(DEPLOY_TX.tbill);
});
