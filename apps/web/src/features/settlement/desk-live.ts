import { createPublicClient, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { DEPLOY_BLOCK } from "./chain";
import type { Phase } from "./clip";
import { POLICY_HASH_V2, RECEIVER_ORG, TRANSFER_ATTEMPT_2 } from "./clip-artifacts";
import { formatClipError, parseHaveWant, stipendToSend } from "./clip-error";
import { topUpClerk } from "./clip-faucet";
import { groth16Receipt } from "./clip-receipts";
import { DESK_ABI, FACTORY_ABI, TBILL_ABI } from "./desk-abi";
import {
  type ClipTxes,
  type DeskFacts,
  factsAfterWrite,
  nextWrite,
  phaseFromDesk,
  txsFromFacts,
} from "./desk-phase";
import { factoryAddress, isClipLive, refuseRearm, resolveDeskPointer } from "./rearm";
import { DESK } from "./settlement";

export type ClipRoomState = {
  live: boolean;
  rearmable: boolean;
  phase: Phase;
  desk: string;
  deskShares: number;
  paulShares: number;
  txs: ClipTxes;
  error?: string;
};

const RPC = process.env.SIETCH_RPC_URL ?? "https://sepolia.base.org";

function tape(error?: string): ClipRoomState {
  return {
    live: false,
    rearmable: false,
    phase: "idle",
    desk: DESK,
    deskShares: 1,
    paulShares: 0,
    txs: {},
    ...(error ? { error } : {}),
  };
}

function clerkKey(): Hex | null {
  const raw = process.env.SIETCH_CLERK_PRIVATE_KEY;
  if (!raw) {
    return null;
  }
  return raw.startsWith("0x") ? (raw as Hex) : (`0x${raw}` as Hex);
}

function envDesk(): `0x${string}` | null {
  return factoryAddress(process.env.SIETCH_DESK_ADDRESS);
}

function envFactory(): `0x${string}` | null {
  return factoryAddress(process.env.SIETCH_FACTORY_ADDRESS);
}

export function isLive(): boolean {
  return isClipLive({
    clerk: Boolean(clerkKey()),
    desk: Boolean(envDesk()),
    factory: Boolean(envFactory()),
    liveFlag: process.env.SIETCH_LIVE,
  });
}

export function isRearmable(): boolean {
  return isLive() && Boolean(envFactory());
}

function publicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http(RPC) });
}

async function readFactoryPointer(): Promise<{ desk: `0x${string}`; fromBlock: bigint } | null> {
  const factory = envFactory();
  if (!factory) {
    return null;
  }
  const client = publicClient();
  const [desk, fromBlock] = await Promise.all([
    client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: "desk",
    }),
    client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: "fromBlock",
    }),
  ]);
  return { desk, fromBlock };
}

async function deskPointer() {
  return resolveDeskPointer({
    factory: await readFactoryPointer(),
    envDesk: process.env.SIETCH_DESK_ADDRESS,
    envFromBlock: process.env.SIETCH_FROM_BLOCK,
    artifactBlock: DEPLOY_BLOCK,
  });
}

async function readFacts(
  desk: `0x${string}`,
  fromBlock: bigint,
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
  try {
    if (!isLive()) {
      return tape();
    }

    const pointer = await deskPointer();
    if (!pointer) {
      return tape();
    }

    const facts = await readFacts(pointer.desk, pointer.fromBlock);
    return {
      live: true,
      rearmable: isRearmable(),
      phase: phaseFromDesk(facts),
      desk: pointer.desk,
      deskShares: facts.deskShares,
      paulShares: facts.paulShares,
      txs: txsFromFacts(facts),
    };
  } catch (error) {
    return tape(formatClipError(error));
  }
}

export async function advanceClip(): Promise<ClipRoomState> {
  const key = clerkKey();
  const pointer = await deskPointer();
  if (!key || !pointer || process.env.SIETCH_LIVE === "0") {
    return tape("not live");
  }

  const before = await readFacts(pointer.desk, pointer.fromBlock);
  const write = nextWrite(phaseFromDesk(before));
  if (!write) {
    return {
      live: true,
      rearmable: isRearmable(),
      phase: "settled",
      desk: pointer.desk,
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

  const hash = await withFaucet(client, account.address, () =>
    write === "publish"
      ? wallet.writeContract({
          address: pointer.desk,
          abi: DESK_ABI,
          functionName: "publishInbound",
          args: [POLICY_HASH_V2],
        })
      : wallet.writeContract({
          address: pointer.desk,
          abi: DESK_ABI,
          functionName: "settle",
          args: settleArgs(write),
        }),
  );

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    return {
      live: true,
      rearmable: isRearmable(),
      phase: phaseFromDesk(before),
      desk: pointer.desk,
      deskShares: before.deskShares,
      paulShares: before.paulShares,
      txs: txsFromFacts(before),
      error: "settle() reverted",
    };
  }

  let after = factsAfterWrite(await readFacts(pointer.desk, pointer.fromBlock), write, hash);
  if (write === "settle-v2") {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && after.paulShares < 1) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      after = factsAfterWrite(await readFacts(pointer.desk, pointer.fromBlock), write, hash);
    }
  }

  return {
    live: true,
    rearmable: isRearmable(),
    phase: phaseFromDesk(after),
    desk: pointer.desk,
    deskShares: after.deskShares,
    paulShares: after.paulShares,
    txs: txsFromFacts(after),
  };
}

export async function rearmClip(): Promise<ClipRoomState> {
  const refusal = refuseRearm({ live: isLive(), factory: Boolean(envFactory()) });
  if (refusal) {
    return { ...tape(refusal.error), live: isLive() };
  }

  const key = clerkKey();
  const factory = envFactory();
  if (!key || !factory) {
    return tape("not live");
  }

  const account = privateKeyToAccount(key);
  const client = publicClient();
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC),
  });

  const value = await rearmValue(client, factory, account.address);
  const hash = await withFaucet(client, account.address, () =>
    wallet.writeContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: "rearm",
      ...(value > 0n ? { value } : {}),
    }),
  );
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    const current = await readClipState();
    return { ...current, error: "rearm() reverted" };
  }

  return readClipState();
}

/** If settle/rearm cannot pay gas, ask Coinbase's Base Sepolia faucet, then retry once. */
async function withFaucet<T>(
  client: ReturnType<typeof publicClient>,
  clerk: `0x${string}`,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const need = parseHaveWant(error);
    if (!need) {
      throw error;
    }
    const top = await topUpClerk({ address: clerk, ...need });
    if ("hash" in top) {
      await client.waitForTransactionReceipt({ hash: top.hash });
      return write();
    }
    if ("error" in top) {
      throw new Error(top.error);
    }
    throw error;
  }
}

/** Stock the factory tank when the clerk can spare it; rearm() then tops the clerk to CLIP_STIPEND. */
async function rearmValue(
  client: ReturnType<typeof publicClient>,
  factory: `0x${string}`,
  clerk: `0x${string}`,
): Promise<bigint> {
  try {
    const stipend = await client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: "CLIP_STIPEND",
    });
    const [clerkBal, factoryBal] = await Promise.all([
      client.getBalance({ address: clerk }),
      client.getBalance({ address: factory }),
    ]);
    const gap = stipendToSend({ stipend, clerk: clerkBal, factory: factoryBal });
    return gap;
  } catch {
    return 0n;
  }
}

function settleArgs(write: "settle-v1" | "settle-v2"): [Hex, Hex, Hex, Hex] {
  const outbound =
    write === "settle-v1"
      ? groth16Receipt("chani-outbound")
      : groth16Receipt("chani-outbound-retry");
  const inbound =
    write === "settle-v1" ? groth16Receipt("paul-inbound-v1") : groth16Receipt("paul-inbound-v2");
  return [
    outbound.proof as Hex,
    outbound.publicValues as Hex,
    inbound.proof as Hex,
    inbound.publicValues as Hex,
  ];
}
