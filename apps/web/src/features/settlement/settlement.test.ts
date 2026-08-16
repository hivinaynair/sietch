import { expect, test } from "bun:test";
import { CLIP_TX } from "./chain";
import { forbiddenCopy, type Phase } from "./clip";
import { channelNote, history, receipts, verdict } from "./settlement";

const PHASES: Phase[] = ["idle", "pending", "published", "settled"];

test("no receipt exists before an instruction", () => {
  const [outbound, inbound] = receipts("idle");
  expect(outbound.allowed).toBeNull();
  expect(inbound.allowed).toBeNull();
  expect(outbound.proof).toBeNull();
  expect(inbound.proof).toBeNull();
});

test("sender allows and beneficiary refuses on the first attempt", () => {
  const [outbound, inbound] = receipts("pending");
  expect(outbound.allowed).toBe(true);
  expect(inbound.allowed).toBe(false);
  expect(verdict("pending").label).toBe("Settlement pending beneficiary policy");
});

test("sides are bound so receipts cannot be swapped", () => {
  for (const phase of PHASES) {
    const [outbound, inbound] = receipts(phase);
    expect(outbound.sideIndex).toBe(0);
    expect(inbound.sideIndex).toBe(1);
  }
});

test("both receipts share one transferId, and a second attempt gets a new one", () => {
  for (const phase of PHASES) {
    const [outbound, inbound] = receipts(phase);
    expect(outbound.transferId).toBe(inbound.transferId);
    expect(outbound.token).toBe(inbound.token);
    expect(outbound.amount).toBe(inbound.amount);
  }
  expect(receipts("settled")[0].transferId).not.toBe(receipts("pending")[0].transferId);
});

test("publishing v2 marks the refusal superseded without erasing it", () => {
  const [, inbound] = receipts("published");
  expect(inbound.allowed).toBe(false);
  expect(inbound.superseded).toBe(true);
  expect(inbound.policyLabel).toContain("v2");
  expect(inbound.policyHash).not.toBe(receipts("pending")[1].policyHash);
  expect(receipts("pending")[1].policyHash).toBe("0x3e9a…3dc4");
  expect(inbound.policyHash).toBe("0x2a32…9e7b");
});

test("only the beneficiary institution ever republishes", () => {
  for (const phase of PHASES) {
    expect(receipts(phase)[0].policyLabel).toBe("Outbound T-bill policy v1");
    expect(receipts(phase)[0].superseded).toBe(false);
  }
});

test("both receipts allow only once settled", () => {
  const [outbound, inbound] = receipts("settled");
  expect(outbound.allowed).toBe(true);
  expect(inbound.allowed).toBe(true);
  expect(inbound.superseded).toBe(false);
  expect(verdict("settled")).toEqual({ label: "Settled for Paul", tone: "settled" });
});

test("history is append-only across the clip", () => {
  const pending = history("pending");
  const published = history("published");
  const settled = history("settled");
  expect(history("idle")).toEqual([]);
  expect(published.slice(0, pending.length)).toEqual([...pending]);
  expect(settled.slice(0, published.length)).toEqual([...published]);
  expect(settled.at(-1)?.what).toContain("posted for Paul");
  expect(pending.find((e) => e.what.startsWith("settle()"))?.tx).toBe(CLIP_TX.settlePending);
  expect(published.find((e) => e.what.includes("Published inbound"))?.tx).toBe(
    CLIP_TX.publishInboundV2,
  );
  expect(settled.at(-1)?.tx).toBe(CLIP_TX.settleForPaul);
});

test("history can link the txs that just landed", () => {
  const hash = `0x${"ab".repeat(32)}`;
  const pending = history("pending", { settlePending: hash });
  expect(pending.find((entry) => entry.what.startsWith("settle()"))?.tx).toBe(hash);
});

test("the refusal stays on the tape after v2 is published", () => {
  const refusal = history("settled").filter((e) => e.what.includes("allowed false"));
  expect(refusal).toHaveLength(1);
});

test("nothing rendered leaks the policy, a reason, or old-rails words", () => {
  for (const phase of PHASES) {
    const rendered = JSON.stringify([
      receipts(phase),
      verdict(phase),
      channelNote(phase),
      history(phase),
    ]);
    expect(forbiddenCopy(rendered)).toEqual([]);
    expect(rendered).not.toMatch(/max_amount|accepts_cross_border|denial|reason/i);
  }
});
