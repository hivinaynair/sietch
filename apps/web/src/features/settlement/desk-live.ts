import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { DEPLOY_BLOCK } from "./chain";
import type { Phase } from "./clip";
import { POLICY_HASH_V2, RECEIVER_ORG, TRANSFER_ATTEMPT_2 } from "./clip-artifacts";
import { DESK_ABI, TBILL_ABI } from "./desk-abi";
import {
  type ClipTxes,
  type DeskFacts,
  nextWrite,
  phaseFromDesk,
  txsFromFacts,
} from "./desk-phase";
import { DESK } from "./settlement";

export type ClipRoomState = {
  live: boolean;
  phase: Phase;
  desk: string;
  deskShares: number;
  paulShares: number;
  txs: ClipTxes;
  error?: string;
};

type ReceiptFile = { proof: string; publicValues: string };

const RPC = process.env.SIETCH_RPC_URL ?? "https://sepolia.base.org";

function clerkKey(): Hex | null {
  const raw = process.env.SIETCH_CLERK_PRIVATE_KEY;
  if (!raw) {
    return null;
  }
  return raw.startsWith("0x") ? (raw as Hex) : (`0x${raw}` as Hex);
}

function deskAddress(): `0x${string}` | null {
  const raw = process.env.SIETCH_DESK_ADDRESS;
  if (!raw?.startsWith("0x") || raw.length !== 42) {
    return null;
  }
  return raw as `0x${string}`;
}

export function isLive(): boolean {
  return Boolean(clerkKey() && deskAddress() && process.env.SIETCH_LIVE !== "0");
}

/**
 * Where to start scanning for the clip's events.
 *
 * Never a window relative to head. A sliding `latest - 9000` meant the transcript quietly
 * emptied about five hours after the clip ran. `SIETCH_FROM_BLOCK` wins; otherwise the desk's
 * deploy block from `artifacts/demo/chain.json`, which `bun run rearm` keeps current; failing
 * both, genesis — slower, but never wrong.
 */
function deskFromBlock(): bigint {
  const configured = process.env.SIETCH_FROM_BLOCK;
  if (configured) {
    return BigInt(configured);
  }
  return DEPLOY_BLOCK ? BigInt(DEPLOY_BLOCK) : 0n;
}

function publicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http(RPC) });
}

function receipt(slug: string): ReceiptFile {
  const file = `${slug}.groth16.json`;
  const candidates = [
    join(import.meta.dirname, "../../../../../artifacts/demo", file),
    join(process.cwd(), "artifacts/demo", file),
    join(process.cwd(), "../../artifacts/demo", file),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`missing receipt ${file}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as ReceiptFile;
}

async function readFacts(
  desk: `0x${string}`,
): Promise<DeskFacts & { deskShares: number; paulShares: number }> {
  const client = publicClient();
  const inboundHash = await client.readContract({
    address: desk,
    abi: DESK_ABI,
    functionName: "policyHashOf",
    args: [RECEIVER_ORG],
  });
  const tbill = await client.readContract({
    address: desk,
    abi: DESK_ABI,
    functionName: "tbill",
  });
  const [deskShares, paulShares, attemptTwoUsed] = await Promise.all([
    client.readContract({
      address: tbill,
      abi: TBILL_ABI,
      functionName: "balanceOf",
      args: [desk],
    }),
    client.readContract({
      address: tbill,
      abi: TBILL_ABI,
      functionName: "balanceOf",
      args: [RECEIVER_ORG],
    }),
    client.readContract({
      address: desk,
      abi: DESK_ABI,
      functionName: "usedTransfer",
      args: [TRANSFER_ATTEMPT_2],
    }),
  ]);

  const fromBlock = deskFromBlock();

  const pending = await client.getContractEvents({
    address: desk,
    abi: DESK_ABI,
    eventName: "SettlementPendingBeneficiaryPolicy",
    fromBlock,
  });
  const published = await client.getContractEvents({
    address: desk,
    abi: DESK_ABI,
    eventName: "InboundPolicyPublished",
    fromBlock,
  });
  const settled = await client.getContractEvents({
    address: desk,
    abi: DESK_ABI,
    eventName: "SettledForPaul",
    fromBlock,
  });

  return {
    inboundHash,
    attemptTwoUsed,
    settlePendingTx: pending[0]?.transactionHash,
    publishTx: published[0]?.transactionHash,
    settleForPaulTx: settled[0]?.transactionHash,
    deskShares: Number(deskShares),
    paulShares: Number(paulShares),
  };
}

export async function readClipState(): Promise<ClipRoomState> {
  if (!isLive()) {
    return { live: false, phase: "idle", desk: DESK, deskShares: 1, paulShares: 0, txs: {} };
  }

  const desk = deskAddress();
  if (!desk) {
    return { live: false, phase: "idle", desk: DESK, deskShares: 1, paulShares: 0, txs: {} };
  }

  const facts = await readFacts(desk);
  return {
    live: true,
    phase: phaseFromDesk(facts),
    desk,
    deskShares: facts.deskShares,
    paulShares: facts.paulShares,
    txs: txsFromFacts(facts),
  };
}

export async function advanceClip(): Promise<ClipRoomState> {
  const key = clerkKey();
  const desk = deskAddress();
  if (!key || !desk || process.env.SIETCH_LIVE === "0") {
    return {
      live: false,
      phase: "idle",
      desk: DESK,
      deskShares: 1,
      paulShares: 0,
      txs: {},
      error: "not live",
    };
  }

  const before = await readFacts(desk);
  const write = nextWrite(phaseFromDesk(before));
  if (!write) {
    return {
      live: true,
      phase: "settled",
      desk,
      deskShares: before.deskShares,
      paulShares: before.paulShares,
      txs: txsFromFacts(before),
      error: "already settled",
    };
  }

  const account = privateKeyToAccount(key);
  const client = publicClient();
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC),
  });

  const hash =
    write === "publish"
      ? await wallet.writeContract({
          address: desk,
          abi: DESK_ABI,
          functionName: "publishInbound",
          args: [POLICY_HASH_V2],
        })
      : await wallet.writeContract({
          address: desk,
          abi: DESK_ABI,
          functionName: "settle",
          args: settleArgs(write),
          gas: 1_500_000n,
        });

  await client.waitForTransactionReceipt({ hash });
  const after = await readFacts(desk);
  return {
    live: true,
    phase: phaseFromDesk(after),
    desk,
    deskShares: after.deskShares,
    paulShares: after.paulShares,
    txs: txsFromFacts(after),
  };
}

function settleArgs(write: "settle-v1" | "settle-v2"): [Hex, Hex, Hex, Hex] {
  const outbound =
    write === "settle-v1" ? receipt("chani-outbound") : receipt("chani-outbound-retry");
  const inbound = write === "settle-v1" ? receipt("paul-inbound-v1") : receipt("paul-inbound-v2");
  return [
    outbound.proof as Hex,
    outbound.publicValues as Hex,
    inbound.proof as Hex,
    inbound.publicValues as Hex,
  ];
}
