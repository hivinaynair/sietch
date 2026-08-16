import { expect, test } from "bun:test";
import { parseEther } from "viem";
import { CLIP_STIPEND_ETH, formatClipError, stipendToSend } from "./clip-error";

const VIEM_DUMP = `The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.

Request Arguments:
  from:  0x2a0E981Ce32242654f10dD05e3259223fc74C024
  to:    0xC647883E905A1898DA4953cF468B1512f3563Ce9
  gas:   1500000

Contract Call:
  function:  settle()

Details: insufficient funds for gas * price + value: have 3391678693696 want 1050000000000000
Version: viem@2.55.16`;

test("an insufficient-funds dump becomes one line with the ETH shortfall", () => {
  expect(formatClipError(VIEM_DUMP)).toBe("Clerk needs 0.00105 ETH (has 0.000003).");
});

test("a rearm dump uses the same short line", () => {
  const rearm = VIEM_DUMP.replace("settle()", "rearm()");
  expect(formatClipError(rearm)).toBe("Clerk needs 0.00105 ETH (has 0.000003).");
});

test("reads have/want off a viem error object", () => {
  const err = Object.assign(new Error("The total cost exceeds the balance of the account."), {
    details: "insufficient funds for gas * price + value: have 3391678693696 want 1050000000000000",
    shortMessage: "The total cost exceeds the balance of the account.",
  });
  expect(formatClipError(err)).toBe("Clerk needs 0.00105 ETH (has 0.000003).");
});

test("other failures stay one short sentence", () => {
  expect(formatClipError("rearm() reverted\nwith a stack")).toBe("rearm() reverted");
});

test("the stipend covers a full clip walk", () => {
  expect(CLIP_STIPEND_ETH).toBe("0.005");
});

test("rearm attaches the factory shortfall when the clerk can spare it", () => {
  expect(
    stipendToSend({
      stipend: parseEther("0.005"),
      clerk: parseEther("0.02"),
      factory: 0n,
    }),
  ).toBe(parseEther("0.005"));
});

test("rearm attaches nothing when the clerk is already short", () => {
  expect(
    stipendToSend({
      stipend: parseEther("0.005"),
      clerk: parseEther("0.000003"),
      factory: 0n,
    }),
  ).toBe(0n);
});
