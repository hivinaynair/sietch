"use client";

import { Decision } from "@repo/metal-shared/types";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { TracePanel } from "@/components/trace-panel";
import { formatUsdc, truncateAddress } from "@/lib/format";
import type { TraceStep } from "@/lib/trace-steps";
import type { AttestationRow } from "@/server/attestations";
import { CopyHex } from "./copy-hex";
import { PublicDetailSheet } from "./detail-sheet-public";
import { VerifyCommitment } from "./verify-commitment";

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  row: AttestationRow | null;
}

function buildSteps(
  row: Extract<AttestationRow, { role: "auditor" | "institution" }>,
): TraceStep[] {
  const approved = row.decision === Decision.Approved;
  const identityOk = row.identityStatus !== 0;
  const amountUsd = formatUsdc(row.amountUsdc);
  const policyMaxUsd = formatUsdc(row.policyMaxAmountUsdc);
  const settlementTx = row.role === "institution" ? row.settlementTx : null;
  const settlementTxUrl = row.role === "institution" ? row.settlementTxUrl : "";

  function stepStatus(n: number): TraceStep["status"] {
    if (approved) return "approved";
    if (!identityOk && n === 2) return "rejected";
    if (!identityOk && n > 2) return "skipped";
    if (!approved && n === 3) return "rejected";
    if (!approved && n > 3) return "skipped";
    return "approved";
  }

  return [
    {
      id: 1,
      label: "402 Challenge",
      status: "approved",
      detail: `$${amountUsd}`,
    },
    {
      id: 2,
      label: "ERC-8004 Identity",
      status: stepStatus(2),
      detail: `${truncateAddress(row.payer)} · ${identityOk ? "registered" : "not registered"}`,
    },
    {
      id: 3,
      label: "AP2 Mandate",
      status: stepStatus(3),
    },
    {
      id: 4,
      label: "Policy Check",
      status: stepStatus(4),
      detail: `ceiling $${policyMaxUsd} · payment $${amountUsd}`,
    },
    {
      id: 5,
      label: "Settlement + Attestation",
      status: approved ? "approved" : "skipped",
      detail: settlementTx ? `${settlementTx.slice(0, 10)}…` : undefined,
      link: settlementTx ? { href: settlementTxUrl, label: "settlement tx" } : undefined,
      attestationLink: row.attestationTx
        ? { href: row.attestationTxUrl, label: "attestation tx" }
        : undefined,
    },
  ];
}

function DisclosedDetailSheet({
  row,
}: {
  row: Extract<AttestationRow, { role: "auditor" | "institution" }>;
}) {
  const approved = row.decision === Decision.Approved;
  const amountUsd = formatUsdc(row.amountUsdc);
  const steps = buildSteps(row);
  const settlementTx = row.role === "institution" ? row.settlementTx : null;
  const settlementTxUrl = row.role === "institution" ? row.settlementTxUrl : "";

  return (
    <>
      <SheetHeader className="mb-6 p-0 pr-14">
        <SheetTitle className="flex items-center gap-2">
          Transaction
          <Badge variant={approved ? "outline" : "destructive"}>
            {approved ? "approved" : "rejected"}
          </Badge>
        </SheetTitle>
        <p className="font-mono text-sm text-muted-foreground">
          {truncateAddress(row.payer)} · ${amountUsd}
        </p>
      </SheetHeader>

      <TracePanel steps={steps} />

      <Separator className="my-4 -mx-6 w-auto" />

      <VerifyCommitment
        key={row.paymentHash}
        paymentHash={row.paymentHash}
        payer={row.payer}
        amountUsdc={row.amountUsdc}
        policyMaxAmountUsdc={row.policyMaxAmountUsdc}
        identityStatus={row.identityStatus}
        decision={row.decision}
        rejectionReason={row.rejectionReason}
        salt={row.commitmentSalt}
        commitment={row.commitment}
      />

      {row.role === "institution" ? (
        <div className="mt-4 flex flex-col gap-3">
          {row.commitmentSalt ? (
            <CopyHex value={row.commitmentSalt} label="Salt" />
          ) : (
            <p className="text-xs text-muted-foreground">No salt (legacy)</p>
          )}
          <CopyHex value={row.paymentHash} label="paymentHash" />
          {settlementTx && settlementTxUrl ? (
            <a
              href={settlementTxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-primary hover:underline"
            >
              settlement tx ↗
            </a>
          ) : null}
          <details className="mt-1">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              decisionRecord
            </summary>
            <pre className="mt-2 overflow-x-auto font-mono text-xs">
              {JSON.stringify(
                row.decisionRecord,
                (_key, value) => (typeof value === "bigint" ? value.toString() : value),
                2,
              )}
            </pre>
          </details>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground">
        <p className="italic">
          AP2 mandate verified off-chain. In production Metal, mandates are enforced as a native
          authorization primitive.
        </p>
        {row.attestationTx ? (
          <a
            href={row.attestationTxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-primary hover:underline"
          >
            attestation tx ↗
          </a>
        ) : null}
      </div>
    </>
  );
}

export function DetailSheet({ open, onClose, row }: DetailSheetProps) {
  if (!row) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-md">
        {row.role === "public" ? (
          <PublicDetailSheet row={row} />
        ) : (
          <DisclosedDetailSheet row={row} />
        )}
      </SheetContent>
    </Sheet>
  );
}
