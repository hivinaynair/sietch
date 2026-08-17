import type { Hex } from "viem";

export type Faucet = (address: `0x${string}`) => Promise<{ transactionHash: Hex } | null>;

export type TopUp = { hash: Hex } | { skipped: "funded" | "no cdp" } | { error: string };

/**
 * CDP's Base Sepolia faucet (0.0001 ETH per claim) is how the clerk pays verifyProof.
 * The factory tank is 0.005 ETH; we do not have that. Coinbase will send testnet gas.
 */
export async function topUpClerk(opts: {
  address: `0x${string}`;
  have: bigint;
  want: bigint;
  faucet?: Faucet;
}): Promise<TopUp> {
  if (opts.have >= opts.want) {
    return { skipped: "funded" };
  }
  const faucet = opts.faucet ?? requestCdpEth;
  try {
    const sent = await faucet(opts.address);
    if (!sent) {
      return { skipped: "no cdp" };
    }
    return { hash: sent.transactionHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : "faucet failed";
    return { error: message.split("\n")[0] ?? "faucet failed" };
  }
}

export function cdpConfigured(): boolean {
  return Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET);
}

export async function requestCdpEth(
  address: `0x${string}`,
): Promise<{ transactionHash: Hex } | null> {
  if (!cdpConfigured()) {
    return null;
  }
  const { CdpClient } = await import("@coinbase/cdp-sdk");
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
  });
  const result = await cdp.evm.requestFaucet({
    address,
    network: "base-sepolia",
    token: "eth",
  });
  return { transactionHash: result.transactionHash as Hex };
}
