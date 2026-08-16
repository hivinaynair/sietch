import { expect, test } from "bun:test";
import { POLICY_HASH_V1, POLICY_HASH_V2 } from "./clip-artifacts";
import { nextWrite, phaseFromDesk, txsFromFacts } from "./desk-phase";

const PENDING = `0x${"aa".repeat(32)}` as const;
const PUBLISH = `0x${"bb".repeat(32)}` as const;
const SETTLED = `0x${"cc".repeat(32)}` as const;

test("an empty desk is idle — nothing instructed", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V1 })).toBe("idle");
});

test("a pending event under inbound v1 is the refuse", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V1, settlePendingTx: PENDING })).toBe("pending");
});

test("inbound v2 with the refuse still on chain is published, not settled", () => {
  expect(
    phaseFromDesk({
      inboundHash: POLICY_HASH_V2,
      settlePendingTx: PENDING,
      publishTx: PUBLISH,
    }),
  ).toBe("published");
});

test("SettledForPaul is the only phase that moved the share", () => {
  expect(
    phaseFromDesk({
      inboundHash: POLICY_HASH_V2,
      settlePendingTx: PENDING,
      publishTx: PUBLISH,
      settleForPaulTx: SETTLED,
    }),
  ).toBe("settled");
});

test("hash comparison is case-insensitive", () => {
  expect(
    phaseFromDesk({
      inboundHash: POLICY_HASH_V2.toUpperCase() as `0x${string}`,
      settlePendingTx: PENDING,
      publishTx: PUBLISH,
    }),
  ).toBe("published");
});

test("the next write follows the clip and stops when settled", () => {
  expect(nextWrite("idle")).toBe("settle-v1");
  expect(nextWrite("pending")).toBe("publish");
  expect(nextWrite("published")).toBe("settle-v2");
  expect(nextWrite("settled")).toBe(null);
});

test("facts become the hashes the room links", () => {
  expect(
    txsFromFacts({
      inboundHash: POLICY_HASH_V2,
      settlePendingTx: PENDING,
      publishTx: PUBLISH,
      settleForPaulTx: SETTLED,
    }),
  ).toEqual({
    settlePending: PENDING,
    publishInboundV2: PUBLISH,
    settleForPaul: SETTLED,
  });
});
