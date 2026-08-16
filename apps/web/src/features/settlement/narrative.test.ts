import { expect, test } from "bun:test";
import { forbiddenCopy, type Phase } from "./clip";
import { announcement, beats, ledger, settlement, whatJustHappened } from "./narrative";

const PHASES: Phase[] = ["idle", "pending", "published", "settled"];

const SAMPLE_TX = {
  settlePending: `0x${"11".repeat(32)}`,
  publishInboundV2: `0x${"22".repeat(32)}`,
  settleForPaul: `0x${"33".repeat(32)}`,
};

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
  expect(settlement("pending", SAMPLE_TX)).toMatchObject({
    tone: "held",
    tx: SAMPLE_TX.settlePending,
  });
  expect(settlement("pending").outbound.allowed).toBe(true);
  expect(settlement("pending").inbound.allowed).toBe(false);
  expect(settlement("settled", SAMPLE_TX)).toMatchObject({
    tone: "settled",
    tx: SAMPLE_TX.settleForPaul,
  });
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
  const published = settlement("published", SAMPLE_TX);
  expect(published.tone).toBe("held");
  expect(published.tx).toBe(SAMPLE_TX.settlePending);
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

test("the ledger never claims the seal hides the clauses", () => {
  for (const phase of PHASES) {
    const { read, never } = ledger(phase);
    expect([...read, ...never].join(" ")).not.toContain("the seal, not the clauses");
  }
});

test("the disclosed column admits the v1 seal is enumerable", () => {
  for (const phase of PHASES.filter((p) => p !== "idle")) {
    expect(ledger(phase).read.join(" ")).toMatch(/enumerab/i);
  }
});

test("the caveat scopes the withheld column at every beat, and names the fix", () => {
  for (const phase of PHASES) {
    const { caveat } = ledger(phase);
    expect(caveat).toMatch(/enumerat/i);
    expect(caveat).toContain("crates/policy");
    expect(caveat).toContain("known limits");
  }
});

test("the withheld column only claims what stayed off the wire", () => {
  const { never } = ledger("settled");
  expect(never.join(" ")).toContain("one policy per stdin");
  expect(never.join(" ")).toContain("only their seals were transmitted");
  // "never saw" was the overclaim: the seal is transmitted and v1's seal gives up its clauses.
  expect(never.join(" ")).not.toMatch(/never saw|cannot read/i);
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
