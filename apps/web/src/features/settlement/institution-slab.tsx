"use client";

import type { Receipt } from "./settlement";

const SIDE_LABEL = {
  outbound: "sending institution",
  inbound: "beneficiary institution",
} as const;

/** The policy is present and unreadable. Bars, not clauses — the network sees the hash. */
function SealedPolicy({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="mt-8 rounded-lg border border-border border-dashed bg-muted/60 px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px]">{label}</p>
        <span className="text-[11px] text-muted-foreground">sealed</span>
      </div>
      <div
        aria-hidden
        className="mt-3 h-4 bg-[repeating-linear-gradient(90deg,var(--foreground)_0_18px,transparent_18px_25px)] opacity-10"
      />
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">{hash}</p>
    </div>
  );
}

function receiptState(receipt: Receipt, issuing: boolean) {
  if (issuing) {
    return { text: "issuing receipt…", tone: "text-muted-foreground" };
  }
  if (receipt.allowed === null) {
    return { text: "no receipt yet", tone: "text-muted-foreground" };
  }
  if (receipt.superseded) {
    return { text: "refused under v1", tone: "text-muted-foreground" };
  }
  return receipt.allowed
    ? { text: "allowed", tone: "text-success" }
    : { text: "refused", tone: "text-destructive" };
}

export function InstitutionSlab({
  receipt,
  active,
  issuing,
}: {
  receipt: Receipt;
  active: boolean;
  issuing: boolean;
}) {
  const state = receiptState(receipt, issuing);

  return (
    <section
      aria-label={receipt.institution}
      className={`flex h-full flex-col justify-between rounded-xl border bg-card px-6 py-6 transition ${
        active ? "border-foreground/35 shadow-[0_0_0_3px_var(--primary)]" : "border-border"
      }`}
    >
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
          {SIDE_LABEL[receipt.side]}
        </p>
        <h2 className="mt-2 font-heading text-[26px] leading-tight tracking-[-0.02em]">
          {receipt.institution}
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">directory book · {receipt.book}</p>
      </div>

      <SealedPolicy label={receipt.policyLabel} hash={receipt.policyHash} />

      <p className={`mt-6 font-heading text-[20px] ${state.tone}`} aria-live="polite">
        {state.text}
      </p>
    </section>
  );
}
