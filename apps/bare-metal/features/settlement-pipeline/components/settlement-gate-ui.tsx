"use client";

import { cn } from "@repo/ui/lib/utils";
import { Check, Lock, X } from "lucide-react";
import type { GateState, settlementGates } from "../lib/settlement-gates";

type GateIcon = (typeof settlementGates)[number]["icon"];

export function GateModule({
  state,
  icon: Icon,
  label,
}: {
  state: GateState;
  icon: GateIcon;
  label: string;
}) {
  const active = state === "approved" || state === "running";
  const blocked = state === "rejected";
  const skipped = state === "skipped";

  const flangeClass = cn(
    "settlement-flange absolute -right-2 -left-2 h-[5px] rounded-[2px] border",
    active && "shadow-glow-positive border-primary",
    blocked && "border-destructive/40",
    !active && !blocked && "border-border",
  );

  return (
    <div className="flex flex-1 flex-col items-center gap-2 pt-16">
      <span
        className={cn(
          "relative z-10 font-mono text-xs font-bold tracking-[0.14em] uppercase",
          state === "running" && "text-foreground",
          state === "approved" && "text-foreground",
          blocked && "text-destructive",
          skipped && "text-muted-foreground/50",
          state === "idle" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <div className={cn("relative", skipped && "opacity-30")}>
        <div className={cn(flangeClass, "top-2")} />
        <div className={cn(flangeClass, "bottom-2")} />
        <div
          className={cn(
            "settlement-gate relative flex h-14 w-9 items-center justify-center rounded-[3px] border",
            active && "border-primary bg-primary/40 shadow-glow-positive",
            blocked && "border-destructive/40 bg-destructive/10 shadow-glow-negative",
            !active && !blocked && "border-border",
          )}
        >
          {active && (
            <div className="gate-glow-positive absolute inset-0 rounded-[3px] opacity-40 blur-sm" />
          )}
          {blocked && (
            <div className="gate-glow-negative absolute inset-0 rounded-[3px] opacity-40 blur-sm" />
          )}
          <Icon
            className={cn(
              "relative size-3.5",
              active && "text-foreground",
              blocked && "text-destructive",
              !active && !blocked && "text-muted-foreground",
            )}
          />
        </div>
        {(state === "approved" || state === "rejected") && (
          <span
            className={cn(
              "absolute -top-2 -right-2 grid size-[18px] place-items-center rounded-full border-2 border-card",
              state === "approved"
                ? "bg-success text-success-foreground"
                : "bg-destructive text-background",
            )}
          >
            {state === "approved" ? <Check className="size-2.5" /> : <X className="size-2.5" />}
          </span>
        )}
        {skipped && <Lock className="absolute -top-2 -right-2 size-3 text-muted-foreground/40" />}
      </div>
    </div>
  );
}

export function MobileStepRow({
  state,
  icon: Icon,
  name,
  amountLabel,
}: {
  state: GateState;
  icon: GateIcon;
  name: string;
  amountLabel: string;
}) {
  const isApproved = state === "approved";
  const isRunning = state === "running";
  const isRejected = state === "rejected";
  const isDim = state === "idle" || state === "skipped";

  const statusText = {
    idle: "waiting",
    running: "processing...",
    approved: "verified",
    rejected: "failed",
    skipped: "skipped",
  }[state];

  return (
    <div className="flex h-14 items-center gap-4 px-5">
      <div
        className={cn(
          "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full transition-all",
          isApproved && "border border-primary bg-primary/40",
          isRunning && "border border-primary bg-primary/50 shadow-glow-positive",
          isRejected && "border border-destructive/40 bg-destructive/15",
          isDim && "border border-border bg-muted opacity-40",
        )}
      >
        <Icon
          className={cn(
            "size-3.5",
            (isApproved || isRunning) && "text-foreground",
            isRejected && "text-destructive",
            isDim && "text-muted-foreground",
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            isApproved && "font-medium text-foreground",
            isRunning && "font-semibold text-foreground",
            isRejected && "font-medium text-destructive",
            isDim && "font-medium text-muted-foreground",
          )}
        >
          {name}
        </p>
        <p
          className={cn(
            "mt-0.5 font-mono text-[10px]",
            isApproved && "text-muted-foreground",
            isRunning && "text-muted-foreground",
            isRejected && "text-destructive/70",
            isDim && "text-muted-foreground/60",
          )}
        >
          {statusText}
        </p>
      </div>

      {isApproved && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="size-2.5" />
        </span>
      )}
      {isRejected && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-background">
          <X className="size-2.5" />
        </span>
      )}
      {isRunning && (
        <span className="shrink-0 rounded border border-primary bg-primary px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
          {amountLabel}
        </span>
      )}
    </div>
  );
}
