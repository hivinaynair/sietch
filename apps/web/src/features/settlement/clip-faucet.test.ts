import { expect, test } from "bun:test";
import { parseEther } from "viem";
import { topUpClerk } from "./clip-faucet";

test("loads the Coinbase SDK only inside the faucet call so Next will not bundle Solana x402", async () => {
  const src = await Bun.file(new URL("./clip-faucet.ts", import.meta.url)).text();
  expect(src).not.toContain('from "@coinbase/cdp-sdk"');
  expect(src).toContain('import("@coinbase/cdp-sdk")');
});

const CLERK = "0x2a0E981Ce32242654f10dD05e3259223fc74C024" as const;

test("does not call the faucet when the clerk can already pay", async () => {
  let called = 0;
  const result = await topUpClerk({
    address: CLERK,
    have: parseEther("0.0001"),
    want: parseEther("0.00001"),
    faucet: async () => {
      called += 1;
      return { transactionHash: "0xabc" };
    },
  });
  expect(called).toBe(0);
  expect(result).toEqual({ skipped: "funded" });
});

test("requests Base Sepolia ETH from CDP when the clerk is short", async () => {
  const result = await topUpClerk({
    address: CLERK,
    have: parseEther("0.000003"),
    want: parseEther("0.00001"),
    faucet: async (address) => {
      expect(address).toBe(CLERK);
      return { transactionHash: "0xfaucet" };
    },
  });
  expect(result).toEqual({ hash: "0xfaucet" });
});

test("skips when CDP is not configured", async () => {
  const result = await topUpClerk({
    address: CLERK,
    have: parseEther("0.000003"),
    want: parseEther("0.00001"),
    faucet: async () => null,
  });
  expect(result).toEqual({ skipped: "no cdp" });
});
