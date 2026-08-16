import type { Phase } from "./clip";
import { POLICY_HASH_V2 } from "./clip-artifacts";

export type DeskWrite = "settle-v1" | "publish" | "settle-v2";

export type DeskFacts = {
  inboundHash: `0x${string}` | string;
  /**
   * `usedTransfer[TRANSFER_ATTEMPT_2]`. Contract state, so unlike an event it never ages out
   * of a log window — this is what keeps a spent desk from reading back as fresh.
   */
  attemptTwoUsed?: boolean;
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

/**
 * What the desk has already done. The room does not invent a phase the chain has not reached.
 *
 * **State first, events second.** A consumed attempt-2 transfer id and the stored inbound hash
 * are contract state with no expiry; event logs are only readable inside whatever block window
 * the RPC was asked for. Deriving the phase from events alone meant a settled desk reported
 * "idle" once its logs fell outside the window, re-armed the control, and reverted on click.
 *
 * Only the refuse has no state footprint — it consumes no transfer id and moves no hash — so
 * `pending` is the single beat that still depends on its event being in range.
 */
export function phaseFromDesk(facts: DeskFacts): Phase {
  if (facts.attemptTwoUsed || facts.settleForPaulTx) {
    return "settled";
  }
  if (norm(facts.inboundHash) === norm(POLICY_HASH_V2)) {
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
