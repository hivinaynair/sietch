"use client";

import { booksLabel } from "./books";
import type { Receipt } from "./settlement";

const SIDE_LABEL = {
  outbound: "sending side",
  inbound: "beneficiary side",
} as const;

/** What this institution is doing during the beat. A publish is not a receipt. */
export type Activity = "issuing" | "publishing" | null;

/** The policy is present and unreadable. Bars, not clauses — the network sees the hash. */
function SealedPolicy({ label, hash, align }: { label: string; hash: string; align: Align }) {
  return (
    <div
      className={`mt-7 w-full rounded-lg border border-border border-dashed bg-muted/60 px-4 py-3.5 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px]">{label}</p>
        <span className="text-[11px] text-muted-foreground">sealed</span>
      </div>
      <div
        aria-hidden
        className="mt-3 h-4 overflow-hidden rounded-[2px] bg-[repeating-linear-gradient(90deg,var(--foreground)_0_18px,transparent_18px_25px)] opacity-10"
      />
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">{hash}</p>
    </div>
  );
}

/**
 * The receipt this institution issued, as a chip rather than a lone word — the verdict
 * band states the pair, so this only has to say which side issued what.
 */
function ReceiptChip({ receipt, activity }: { receipt: Receipt; activity: Activity }) {
  if (activity === "issuing") {
    return <span className="text-[13px] text-muted-foreground">submitting settle()…</span>;
  }
  if (activity === "publishing") {
    return <span className="text-[13px] text-muted-foreground">submitting publish()…</span>;
  }
  if (receipt.allowed === null) {
    return <span className="text-[13px] text-muted-foreground">no receipt yet</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] ${
        receipt.allowed
          ? "border-success/25 bg-success/8 text-success"
          : "border-destructive/25 bg-destructive/8 text-destructive"
      }`}
    >
      <span aria-hidden className="font-mono">
        {receipt.allowed ? "✓" : "✗"}
      </span>
      {receipt.side} {receipt.allowed ? "allowed" : "refused"}
      {receipt.superseded && <span className="text-muted-foreground">· under v1</span>}
    </span>
  );
}

type Align = "left" | "right";

/**
 * One column per person. Chani and Paul name the ends of the room and are always
 * both present — there is no seat to hold. The institution is the backing line.
 */
export function InstitutionSlab({
  receipt,
  active,
  activity,
  shares,
  align = "left",
}: {
  receipt: Receipt;
  active: boolean;
  activity: Activity;
  /** On-chain sTBILL count for this side. Desk for Chani; Paul’s institution for Paul. */
  shares?: number;
  align?: Align;
}) {
  return (
    <section
      aria-label={receipt.person}
      className={`flex h-full flex-col justify-between rounded-xl border bg-card px-6 py-6 transition ${
        align === "right" ? "items-end text-right" : "items-start"
      } ${active ? "border-foreground/35 shadow-[0_0_0_3px_var(--primary)]" : "border-border"}`}
    >
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
          {SIDE_LABEL[receipt.side]}
        </p>
        <h2 className="mt-2 font-heading text-[32px] leading-tight tracking-[-0.02em]">
          {receipt.person}
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {receipt.institution} · directory book {receipt.book}
        </p>
        {shares !== undefined ? (
          <p className="mt-3 font-heading text-[22px] tabular-nums tracking-[-0.02em]">
            {booksLabel(receipt.side, shares)}
          </p>
        ) : null}
      </div>

      <SealedPolicy label={receipt.policyLabel} hash={receipt.policyHash} align={align} />

      <div className="mt-5">
        <ReceiptChip receipt={receipt} activity={activity} />
      </div>
    </section>
  );
}
