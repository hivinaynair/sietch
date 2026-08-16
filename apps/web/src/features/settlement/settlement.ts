/**
 * Facts the settlement room renders, derived from the clip phase.
 *
 * Everything here is public — it is what an observer of Base Sepolia could read.
 * Policy clauses are never modelled, only their hashes. See
 * docs/plans/2026-08-15-sietch-design.md §4 (threat model) and §8 (guest I/O).
 */
import type { Phase } from "./clip";
import {
  PROGRAM_VKEY as ARTIFACT_VKEY,
  POLICY_HASH_V1,
  POLICY_HASH_V2,
  RECEIPT_TOKEN,
  RECEIVER_ORG,
  receiptsFor,
  SENDER_ORG,
  shorten,
  TRANSFER_ATTEMPT_1,
  TRANSFER_ATTEMPT_2,
} from "./clip-artifacts";

export const NETWORK = "Base Sepolia · 84532";

/** Fingerprint of the guest ELF. From artifacts/demo/*.groth16.json. */
export const PROGRAM_VKEY = ARTIFACT_VKEY;

/** Succinct's canonical Groth16 gateway on Base Sepolia. We call it; we do not deploy one. */
export const VERIFIER_GATEWAY = "0x397A5f7f3dBd538f23DE225B51f532c34448dA9B";

/** Live desk from artifacts/demo/chain.json. Share posts to 0x2222…, not a customer wallet. */
export const DESK = "0xF94822401F3DdEC9e53c4143A4eFEdF61488dFA7";
export const TBILL = "0x66DD7896EAec4Bf7Dc41f3Ad259F6b69e36e7984";

const SETTLE_PENDING = "0xc445…8198";
const PUBLISH_V2 = "0xfe31…417f";
const SETTLE_FOR_PAUL = "0xcf31…8c27";

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

const TOKEN = shorten(RECEIPT_TOKEN);
const ORG_SEND = shorten(SENDER_ORG);
const ORG_RECV = shorten(RECEIVER_ORG);
const ATTEMPT_1 = shorten(TRANSFER_ATTEMPT_1);
const ATTEMPT_2 = shorten(TRANSFER_ATTEMPT_2);
const HASH_V1 = shorten(POLICY_HASH_V1);
const HASH_V2 = shorten(POLICY_HASH_V2);

export type Side = "outbound" | "inbound";

export type Receipt = {
  side: Side;
  /** 0 = sender (outbound), 1 = receiver (inbound). Bound in public values so receipts cannot be swapped. */
  sideIndex: 0 | 1;
  /** The customer this side speaks for. Names the column; the institution backs it. */
  person: string;
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
  const transferId = settled ? ATTEMPT_2 : ATTEMPT_1;
  const pair = receiptsFor(phase);

  return [
    {
      side: "outbound",
      sideIndex: 0,
      person: DELIVERY.sender,
      institution: "Chani’s institution",
      book: DELIVERY.senderBook,
      org: ORG_SEND,
      token: TOKEN,
      amount: DELIVERY.amount,
      policyLabel: "Outbound T-bill policy v1",
      policyHash: HASH_V1,
      transferId,
      allowed: issued ? true : null,
      proof: issued ? shorten(pair.outbound.proof) : null,
      attempt,
      superseded: false,
    },
    {
      side: "inbound",
      sideIndex: 1,
      person: DELIVERY.beneficiary,
      institution: "Paul’s institution",
      book: DELIVERY.beneficiaryBook,
      org: ORG_RECV,
      token: TOKEN,
      amount: DELIVERY.amount,
      policyLabel: inboundV2 ? "Inbound T-bill policy v2" : "Inbound T-bill policy v1",
      policyHash: inboundV2 ? HASH_V2 : HASH_V1,
      transferId,
      allowed: issued ? settled : null,
      proof: issued ? shorten(pair.inbound.proof) : null,
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

  const first = receiptsFor("pending");
  const second = receiptsFor("settled");
  const attemptOne: Entry[] = [
    { at: "00:00", who: "Chani", what: "Instructed a delivery of 1 share to Paul" },
    {
      at: "00:01",
      who: "Chani’s institution",
      what: "Receipt · side outbound · allowed true",
      hash: shorten(first.outbound.proof),
    },
    {
      at: "00:01",
      who: "Paul’s institution",
      what: "Receipt · side inbound · allowed false",
      hash: shorten(first.inbound.proof),
    },
    {
      at: "00:02",
      who: "Desk",
      what: "settle() · no transfer · settlement pending beneficiary policy",
      hash: SETTLE_PENDING,
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
      hash: PUBLISH_V2,
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
      hash: shorten(second.outbound.proof),
    },
    {
      at: "01:15",
      who: "Paul’s institution",
      what: "Receipt · side inbound · allowed true",
      hash: shorten(second.inbound.proof),
    },
    {
      at: "01:16",
      who: "Desk",
      what: "settle() · 1 share posted for Paul",
      hash: SETTLE_FOR_PAUL,
      tone: "settled",
    },
  ];
}
