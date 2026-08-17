/**
 * What the room says about a phase, as opposed to what the chain holds (settlement.ts).
 *
 * Three questions, one answer each, because a viewer who has not lived in ZK cannot infer
 * them from receipts alone: where are we in the clip, what did settle() do with the two
 * receipts, and what did the chain learn versus never see.
 *
 * Nothing here weakens the threat model in docs/plans/2026-08-15-sietch-design.md §4:
 * no clause bytes, no reason enum, no copy from the forbidden list in clip.ts.
 */
import { CLIP_TX } from "./chain";
import type { Phase } from "./clip";
import type { ClipTxes } from "./desk-phase";

export type BeatStatus = "done" | "current" | "upcoming";

export type Beat = {
  n: 1 | 2 | 3;
  /**
   * Past tense once it has landed, imperative while it is still ahead. A beat that has
   * not happened must never be labelled as though it had — that is what made a refusal
   * read as a broken demo rather than the point of the clip.
   */
  label: string;
  status: BeatStatus;
};

const LANDED: Record<Phase, number> = {
  idle: 0,
  pending: 1,
  published: 2,
  settled: 3,
};

/** Where we are in a three-beat clip, so a refusal reads as act one. */
export function beats(phase: Phase): readonly Beat[] {
  const landed = LANDED[phase];
  const status = (n: number): BeatStatus =>
    n <= landed ? "done" : n === landed + 1 ? "current" : "upcoming";

  return [
    { n: 1, label: landed >= 1 ? "refused" : "instruct the delivery", status: status(1) },
    { n: 2, label: landed >= 2 ? "inbound v2 published" : "publish inbound v2", status: status(2) },
    {
      n: 3,
      label: landed >= 3 ? "settled for Paul" : "instruct the same delivery",
      status: status(3),
    },
  ] as const;
}

export type Operand = {
  side: "outbound" | "inbound";
  issuer: string;
  allowed: boolean | null;
  /** True when this receipt belongs to an attempt the beneficiary has since moved past. */
  historic: boolean;
};

export type Settlement = {
  outbound: Operand;
  inbound: Operand;
  /** What settle() did with the pair. Never why — a reason would be an oracle for the policy. */
  outcome: string;
  tone: "idle" | "held" | "settled";
  /** The settle() transaction this pair was put to, once one exists. */
  tx?: string;
  /** Only for the gap where v2 is in force but no new pair has been instructed. */
  footnote?: string;
};

const OUTBOUND = { side: "outbound", issuer: "Chani’s institution" } as const;
const INBOUND = { side: "inbound", issuer: "Paul’s institution" } as const;

/**
 * Settlement is the AND of two receipts. Stating it in prose leaves the reader to take it
 * on trust; these are the operands and the result, so the AND can be read as an operation.
 */
export function settlement(phase: Phase, txs: ClipTxes = CLIP_TX): Settlement {
  switch (phase) {
    case "idle":
      return {
        outbound: { ...OUTBOUND, allowed: null, historic: false },
        inbound: { ...INBOUND, allowed: null, historic: false },
        outcome: "nothing instructed",
        tone: "idle",
      };
    case "pending":
      return {
        outbound: { ...OUTBOUND, allowed: true, historic: false },
        inbound: { ...INBOUND, allowed: false, historic: false },
        outcome: "no transfer · settlement pending beneficiary policy",
        tone: "held",
        tx: txs.settlePending,
      };
    case "published":
      return {
        outbound: { ...OUTBOUND, allowed: true, historic: true },
        inbound: { ...INBOUND, allowed: false, historic: true },
        outcome: "no transfer · the pair on chain is still attempt 1",
        tone: "held",
        tx: txs.settlePending,
        footnote:
          "Inbound v2 is in force, but a policy version is not a settlement. The same delivery has to be instructed again before either institution issues a new receipt.",
      };
    case "settled":
      return {
        outbound: { ...OUTBOUND, allowed: true, historic: false },
        inbound: { ...INBOUND, allowed: true, historic: false },
        outcome: "1 share posted for Paul",
        tone: "settled",
        tx: txs.settleForPaul,
      };
  }
}

/** One line naming the event that just landed. The room's headline states voice, not event. */
export function whatJustHappened(phase: Phase): string {
  switch (phase) {
    case "idle":
      return "Nothing has been instructed. Both policies are sealed and in force.";
    case "pending":
      return "Chani instructed. Her institution issued an allow, Paul’s issued a refusal, and settle() moved nothing.";
    case "published":
      return "Paul’s institution published inbound v2. The refusal stays on the transcript. Publishing a version never rewrites it.";
    case "settled":
      return "Chani instructed the same delivery. Both institutions issued an allow against a new transfer id, and the share posted for Paul.";
  }
}

export type Ledger = {
  read: readonly string[];
  never: readonly string[];
  /**
   * The honest scope on the second column. Withholding bytes from the wire is not the same
   * as hiding them, and for a two-field policy under an unsalted hash it is much weaker.
   * Stated here rather than left for the reader to work out, because the reader who works
   * it out on his own has caught us claiming something we did not earn.
   */
  caveat: string;
};

const CAVEAT =
  "The v1 seal enumerates in under 200 guesses; the fix is in crates/policy. See known limits.";

/**
 * What settlement disclosed, against what it kept off the wire — scoped by `caveat`.
 * Three short lines each; a walk should not have to read a brief.
 */
export function ledger(phase: Phase): Ledger {
  const never = [
    "The other institution’s policy: one policy per stdin, never both",
    "Which clause refused: the desk emits no such field",
    "The clauses in bytes: only their seals were transmitted",
  ] as const;

  if (phase === "idle") {
    return { read: ["Nothing yet. Chani has not instructed"], never, caveat: CAVEAT };
  }

  const read = [
    "Two booleans: outbound allowed, inbound allowed",
    "Two policy seals. v1’s is enumerable",
    phase === "settled" ? "Both receipts verified for this vkey" : "One transfer id per attempt",
  ];

  return { read, never, caveat: CAVEAT };
}

/**
 * The single sentence a screen reader hears when the room advances. The room used to fire
 * five live regions at once, in undefined order; this is the only one now.
 */
export function announcement(phase: Phase): string {
  const { outbound, inbound, outcome } = settlement(phase);
  const verdict = (allowed: boolean | null) =>
    allowed === null ? "no receipt" : allowed ? "allowed" : "refused";

  if (phase === "idle") {
    return "Nothing instructed. No receipts yet.";
  }

  return `Outbound ${verdict(outbound.allowed)}, inbound ${verdict(inbound.allowed)}. ${outcome}.`;
}
