import type { Phase } from "./clip";
import { POLICY_HASH_V2 } from "./clip-artifacts";

export type DeskWrite = "settle-v1" | "publish" | "settle-v2";

export type DeskFacts = {
  inboundHash: `0x${string}` | string;
  settlePendingTx?: `0x${string}` | string;
  publishTx?: `0x${string}` | string;
  settleForPaulTx?: `0x${string}` | string;
};

export type ClipTxes = {
  settlePending?: string;
  publishInboundV2?: string;
  settleForPaul?: string;
};

function norm(hash: string): string {
  return hash.toLowerCase();
}

/** What the desk has already done. The room does not invent a phase the chain has not reached. */
export function phaseFromDesk(facts: DeskFacts): Phase {
  if (facts.settleForPaulTx) {
    return "settled";
  }
  if (facts.settlePendingTx && norm(facts.inboundHash) === norm(POLICY_HASH_V2)) {
    return "published";
  }
  if (facts.settlePendingTx) {
    return "pending";
  }
  return "idle";
}

export function nextWrite(phase: Phase): DeskWrite | null {
  switch (phase) {
    case "idle":
      return "settle-v1";
    case "pending":
      return "publish";
    case "published":
      return "settle-v2";
    case "settled":
      return null;
  }
}

export function txsFromFacts(facts: DeskFacts): ClipTxes {
  return {
    settlePending: facts.settlePendingTx,
    publishInboundV2: facts.publishTx,
    settleForPaul: facts.settleForPaulTx,
  };
}
