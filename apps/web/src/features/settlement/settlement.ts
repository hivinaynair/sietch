/**
 * Facts the settlement room renders, derived from the clip phase.
 *
 * Everything here is public — it is what an observer of Base Sepolia could read.
 * Policy clauses are never modelled, only their hashes. See
 * docs/plans/2026-08-15-sietch-design.md §4 (threat model) and §8 (guest I/O).
 */
import type { Phase } from "./clip";

export const NETWORK = "Base Sepolia · 84532";

/** Fingerprint of the guest ELF. From artifacts/demo/chani-outbound.execute.json. */
export const PROGRAM_VKEY = "0x00035e8be65b2881b5409b3238047ddd679c9cce04cb4140973e04e9ed3330cd";

/** Succinct's canonical Groth16 gateway on Base Sepolia. We call it; we do not deploy one. */
export const VERIFIER_GATEWAY = "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B";

/** Cycle count of one execute. Tiny on purpose — this is a policy check, not a workload. */
export const EXECUTE_CYCLES = 25_521;

export const DELIVERY = {
  asset: "Sietch T-Bill Share (demo)",
  symbol: "sTBILL",
  amount: "1",
  sender: "Chani",
  beneficiary: "Paul",
  senderBook: "India",
  beneficiaryBook: "US",
} as const;

/**
 * Placeholders until Groth16 runs and artifacts/demo/*.groth16.json exists.
 * Only the vkey and the sender's public values above come from a real execute.
 */
const SENDER_ORG = "0x1111…1111";
const RECEIVER_ORG = "0x2222…2222";
const TOKEN = "0x3333…3333";
const TRANSFER_ATTEMPT_1 = "0x4444…4444";
const TRANSFER_ATTEMPT_2 = "0x7c1a…9e02";

export type Side = "outbound" | "inbound";

export type Receipt = {
  side: Side;
  /** 0 = sender (outbound), 1 = receiver (inbound). Bound in public values so receipts cannot be swapped. */
  sideIndex: 0 | 1;
  institution: string;
  book: string;
  org: string;
  token: string;
  amount: string;
  policyLabel: string;
  policyHash: string;
  transferId: string;
  /** null before this institution has issued a receipt for the current instruction. */
  allowed: boolean | null;
  proof: string | null;
  /** Which settlement attempt this receipt belongs to. */
  attempt: 1 | 2;
  /** True when the institution republished after issuing this receipt. */
  superseded: boolean;
};

export function receipts(phase: Phase): readonly [Receipt, Receipt] {
  const settled = phase === "settled";
  const issued = phase !== "idle";
  const inboundV2 = phase === "published" || settled;
  const attempt = settled ? 2 : 1;
  const transferId = settled ? TRANSFER_ATTEMPT_2 : TRANSFER_ATTEMPT_1;

  return [
    {
      side: "outbound",
      sideIndex: 0,
      institution: "Chani’s institution",
      book: DELIVERY.senderBook,
      org: SENDER_ORG,
      token: TOKEN,
      amount: DELIVERY.amount,
      policyLabel: "Outbound T-bill policy v1",
      policyHash: "0x3e9a…3dc4",
      transferId,
      allowed: issued ? true : null,
      proof: issued ? "0x9f21…a70b" : null,
      attempt,
      superseded: false,
    },
    {
      side: "inbound",
      sideIndex: 1,
      institution: "Paul’s institution",
      book: DELIVERY.beneficiaryBook,
      org: RECEIVER_ORG,
      token: TOKEN,
      amount: DELIVERY.amount,
      policyLabel: inboundV2 ? "Inbound T-bill policy v2" : "Inbound T-bill policy v1",
      policyHash: inboundV2 ? "0xb0d7…41ae" : "0x5c88…d112",
      transferId,
      allowed: issued ? settled : null,
      proof: issued ? (settled ? "0x1d40…88fc" : "0xc7be…2201") : null,
      attempt,
      superseded: phase === "published",
    },
  ] as const;
}

export type VerdictTone = "idle" | "held" | "settled";

export type Verdict = { label: string; tone: VerdictTone };

/** Settlement is the AND of both receipts. No reason field — that would be an oracle for the policy. */
export function verdict(phase: Phase): Verdict {
  switch (phase) {
    case "idle":
      return { label: "No instruction yet", tone: "idle" };
    case "pending":
      return { label: "Settlement pending beneficiary policy", tone: "held" };
    case "published":
      return { label: "Inbound v2 in force · awaiting the same instruction", tone: "idle" };
    case "settled":
      return { label: "Settled for Paul", tone: "settled" };
  }
}

export function channelNote(phase: Phase): string {
  switch (phase) {
    case "idle":
      return "nothing instructed";
    case "pending":
      return "held at the beneficiary door";
    case "published":
      return "beneficiary door open · inbound v2";
    case "settled":
      return "settled on the beneficiary’s books";
  }
}

export type Entry = {
  at: string;
  who: string;
  what: string;
  hash?: string;
  tone?: Exclude<VerdictTone, "idle">;
};

/** Chain history so far. Append-only: publishing v2 never rewrites the refusal. */
export function history(phase: Phase): readonly Entry[] {
  if (phase === "idle") {
    return [];
  }

  const attemptOne: Entry[] = [
    { at: "00:00", who: "Chani", what: "Instructed a delivery of 1 share to Paul" },
    {
      at: "00:01",
      who: "Chani’s institution",
      what: "Receipt · side outbound · allowed true",
      hash: "0x9f21…a70b",
    },
    {
      at: "00:01",
      who: "Paul’s institution",
      what: "Receipt · side inbound · allowed false",
      hash: "0xc7be…2201",
    },
    {
      at: "00:02",
      who: "Desk",
      what: "settle() · no transfer · settlement pending beneficiary policy",
      hash: "0x0ac3…5b18",
      tone: "held",
    },
  ];

  if (phase === "pending") {
    return attemptOne;
  }

  const published: Entry[] = [
    ...attemptOne,
    {
      at: "01:10",
      who: "Paul’s institution",
      what: "Published inbound T-bill policy v2",
      hash: "0xb0d7…41ae",
    },
  ];

  if (phase === "published") {
    return published;
  }

  return [
    ...published,
    { at: "01:14", who: "Chani", what: "Instructed the same delivery again" },
    {
      at: "01:15",
      who: "Chani’s institution",
      what: "Receipt · side outbound · allowed true",
      hash: "0x9f21…a70b",
    },
    {
      at: "01:15",
      who: "Paul’s institution",
      what: "Receipt · side inbound · allowed true",
      hash: "0x1d40…88fc",
    },
    {
      at: "01:16",
      who: "Desk",
      what: "settle() · 1 share posted for Paul",
      hash: "0xe5f9…7d33",
      tone: "settled",
    },
  ];
}
