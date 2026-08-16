import { expect, test } from "bun:test";
import { POLICY_HASH_V1, POLICY_HASH_V2 } from "./clip-artifacts";
import { factsAfterWrite, nextWrite, phaseFromDesk, txsFromFacts } from "./desk-phase";

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

/**
 * The window bug: phase used to be read entirely off event logs, scanned from a sliding
 * `latest - 9000` block window (≈5h on Base). Once a settled desk's events aged out, the room
 * reported "idle", re-enabled the control, and the next click reverted on chain. Contract
 * state has no expiry, so state decides the phase and events only supply link targets.
 */
test("a settled desk stays settled after its events age out of the window", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V2, attemptTwoUsed: true })).toBe("settled");
});

test("a published desk stays published without the pending event", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V2 })).toBe("published");
});

test("a consumed attempt-2 id means settled even if inbound was republished to v1", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V1, attemptTwoUsed: true })).toBe("settled");
});

test("a fresh desk with no events and v1 in force is idle", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V1, attemptTwoUsed: false })).toBe("idle");
});

test("the pending beat is the one with no state footprint, so it still needs its event", () => {
  // settle() that refuses consumes no transferId and moves no hash — only an event marks it.
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V1, attemptTwoUsed: false })).toBe("idle");
  expect(
    phaseFromDesk({ inboundHash: POLICY_HASH_V1, attemptTwoUsed: false, settlePendingTx: PENDING }),
  ).toBe("pending");
});

test("the next write follows the clip and stops when settled", () => {
  expect(nextWrite("idle")).toBe("settle-v1");
  expect(nextWrite("pending")).toBe("publish");
  expect(nextWrite("published")).toBe("settle-v2");
  expect(nextWrite("settled")).toBe(null);
});

test("a receipt we just waited on advances the phase even if logs are still empty", () => {
  const stale = { inboundHash: POLICY_HASH_V1, attemptTwoUsed: false };
  expect(phaseFromDesk(factsAfterWrite(stale, "settle-v1", PENDING))).toBe("pending");
  expect(phaseFromDesk(factsAfterWrite(stale, "publish", PUBLISH))).toBe("published");
  expect(phaseFromDesk(factsAfterWrite(stale, "settle-v2", SETTLED))).toBe("settled");
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
