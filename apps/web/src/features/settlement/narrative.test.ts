import { expect, test } from "bun:test";
import { CLIP_TX } from "./chain";
import { forbiddenCopy, type Phase } from "./clip";
import { announcement, beats, ledger, settlement, whatJustHappened } from "./narrative";

const PHASES: Phase[] = ["idle", "pending", "published", "settled"];

test("a beat that has not happened is never labelled as though it had", () => {
  expect(beats("idle").map((b) => b.label)).toEqual([
    "instruct the delivery",
    "publish inbound v2",
    "instruct the same delivery",
  ]);
  expect(beats("pending")[0]?.label).toBe("refused");
  expect(beats("pending")[1]?.label).toBe("publish inbound v2");
  expect(beats("published")[1]?.label).toBe("inbound v2 published");
  expect(beats("settled")[2]?.label).toBe("settled for Paul");
});

test("exactly one beat is current until the room is settled", () => {
  for (const phase of PHASES) {
    const current = beats(phase).filter((b) => b.status === "current");
    expect(current).toHaveLength(phase === "settled" ? 0 : 1);
  }
  expect(beats("settled").every((b) => b.status === "done")).toBe(true);
});

test("beats land in order and never un-land", () => {
  const landed = (phase: Phase) => beats(phase).filter((b) => b.status === "done").length;
  expect([landed("idle"), landed("pending"), landed("published"), landed("settled")]).toEqual([
    0, 1, 2, 3,
  ]);
});

test("settlement is the AND of the two receipts", () => {
  expect(settlement("idle").outbound.allowed).toBeNull();
  expect(settlement("pending")).toMatchObject({ tone: "held", tx: CLIP_TX.settlePending });
  expect(settlement("pending").outbound.allowed).toBe(true);
  expect(settlement("pending").inbound.allowed).toBe(false);
  expect(settlement("settled")).toMatchObject({ tone: "settled", tx: CLIP_TX.settleForPaul });
  expect(settlement("settled").outbound.allowed).toBe(true);
  expect(settlement("settled").inbound.allowed).toBe(true);
});

test("only both-allowed moves the share", () => {
  for (const phase of PHASES) {
    const { outbound, inbound, outcome } = settlement(phase);
    const moved = outbound.allowed === true && inbound.allowed === true;
    expect(outcome.includes("posted for Paul")).toBe(moved);
  }
});

test("publishing v2 does not settle: the pair on chain is still attempt 1", () => {
  const published = settlement("published");
  expect(published.tone).toBe("held");
  expect(published.tx).toBe(CLIP_TX.settlePending);
  expect(published.outbound.historic).toBe(true);
  expect(published.inbound.historic).toBe(true);
  expect(published.footnote).toBeDefined();
});

test("the ledger always names what the chain cannot read", () => {
  for (const phase of PHASES) {
    const { read, never } = ledger(phase);
    expect(read.length).toBeGreaterThan(0);
    expect(never).toHaveLength(3);
    expect(never.join(" ")).toContain("clauses");
  }
  expect(ledger("idle").read.join(" ")).toContain("Nothing yet");
});

test("the room speaks once per beat, and says the pair", () => {
  expect(announcement("idle")).toContain("Nothing instructed");
  expect(announcement("pending")).toBe(
    "Outbound allowed, inbound refused. no transfer · settlement pending beneficiary policy.",
  );
  expect(announcement("settled")).toContain("1 share posted for Paul");
});

test("nothing the narrative renders leaks a policy, a reason, or old-rails words", () => {
  for (const phase of PHASES) {
    const rendered = JSON.stringify([
      beats(phase),
      settlement(phase),
      ledger(phase),
      whatJustHappened(phase),
      announcement(phase),
    ]);
    expect(forbiddenCopy(rendered)).toEqual([]);
    expect(rendered).not.toMatch(/max_amount|accepts_cross_border|denial|reason/i);
  }
});
