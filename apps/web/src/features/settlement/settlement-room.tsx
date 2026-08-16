"use client";

import { useCallback, useEffect, useState } from "react";
import { Channel } from "./channel";
import {
  type Action,
  actionLabel,
  applyAction,
  availableAction,
  createClip,
  type Seat,
  seatCopy,
  setSeat,
  youAre,
} from "./clip";
import { InstitutionSlab } from "./institution-slab";
import { SeatSwitcher } from "./seat-switcher";
import { DELIVERY, DESK, history, NETWORK, PROGRAM_VKEY, receipts, verdict } from "./settlement";
import { Transcript } from "./transcript";

/** Long enough to read as two institutions answering separately, short enough to stay instant. */
const RECEIPT_BEAT_MS = 650;

const VERDICT_TONE = {
  idle: "text-muted-foreground",
  held: "text-destructive",
  settled: "text-success",
} as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function SettlementRoom() {
  const [clip, setClip] = useState(createClip);
  const [busy, setBusy] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!busy) {
      return;
    }
    const timer = window.setTimeout(() => setBusy(false), RECEIPT_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  const seat = useCallback((next: Seat) => setClip((current) => setSeat(current, next)), []);

  const run = useCallback(
    (next: Action) => {
      setClip((current) => applyAction(current, next));
      if (!reduced) {
        setBusy(true);
      }
    },
    [reduced],
  );

  const reset = useCallback(() => {
    setBusy(false);
    setClip(createClip());
  }, []);

  const [outbound, inbound] = receipts(clip.phase);
  const settlement = verdict(clip.phase);
  const action = availableAction(clip);
  const onSendingSide = clip.seat === "chani" || clip.seat === "chani-institution";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-8 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-semibold text-[16px] tracking-[-0.02em]">Sietch</h1>
            <span className="hidden text-[12px] text-muted-foreground sm:inline">
              Inter-institutional settlement · demo
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="font-mono text-[11px] text-muted-foreground">{NETWORK}</span>
            </span>
            <button
              type="button"
              onClick={reset}
              className="text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-8 pt-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
          <SeatSwitcher side="sending" seat={clip.seat} onSeat={seat} />
          <p className="hidden min-w-[240px] text-center text-[10.5px] text-muted-foreground uppercase tracking-[0.14em] lg:block">
            seated as
          </p>
          <SeatSwitcher side="beneficiary" seat={clip.seat} onSeat={seat} align="right" />
        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <InstitutionSlab
            receipt={outbound}
            active={onSendingSide}
            issuing={busy && clip.phase === "pending"}
          />
          <Channel phase={clip.phase} busy={busy} />
          <InstitutionSlab receipt={inbound} active={!onSendingSide} issuing={busy} />
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-8 border-border border-t pt-8">
          <div className="max-w-xl">
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
              {youAre(clip)}
            </p>
            <p className="mt-3 font-heading text-[30px] leading-[1.15] tracking-[-0.02em]">
              {seatCopy(clip)}
            </p>
            <p className={`mt-4 text-[13px] ${VERDICT_TONE[settlement.tone]}`} aria-live="polite">
              {settlement.label} · {DELIVERY.amount} {DELIVERY.symbol} · {DELIVERY.sender} →{" "}
              {DELIVERY.beneficiary}
            </p>
          </div>

          <button
            type="button"
            disabled={!action || busy}
            onClick={() => action && run(action)}
            className="h-11 rounded-full bg-foreground px-6 text-[13.5px] text-background transition disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {action ? actionLabel(action) : "No action from this seat"}
          </button>
        </div>

        <div className="mt-10 pb-16">
          <Transcript entries={history(clip.phase)} />
          <p className="mt-5 break-all font-mono text-[11px] text-muted-foreground">
            desk {DESK}
            <br />
            vkey {PROGRAM_VKEY}
          </p>
        </div>
      </main>
    </div>
  );
}
