"use client";

import { useCallback, useEffect, useState } from "react";
import { BeatSpine } from "./beat-spine";
import { addressUrl } from "./chain";
import { Channel } from "./channel";
import { type Action, advance, availableAction, createClip, nextMove } from "./clip";
import { type Activity, InstitutionSlab } from "./institution-slab";
import { announcement } from "./narrative";
import { PrivacyLedger } from "./privacy-ledger";
import { DELIVERY, DESK, history, NETWORK, PROGRAM_VKEY, receipts } from "./settlement";
import { Transcript } from "./transcript";
import { VerdictBand } from "./verdict-band";

/** Long enough to read as two institutions answering separately, short enough to stay instant. */
const RECEIPT_BEAT_MS = 650;

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

/**
 * What each side is doing during the beat, from the move being taken rather than the
 * phase being entered. Only an instruction produces receipts, and it produces two of
 * them: a publish is one institution changing its own rulebook, not a receipt at all.
 */
function activityFor(action: Action | null): { outbound: Activity; inbound: Activity } {
  if (action === "instruct") {
    return { outbound: "issuing", inbound: "issuing" };
  }
  if (action === "publish") {
    return { outbound: null, inbound: "publishing" };
  }
  return { outbound: null, inbound: null };
}

export function SettlementRoom() {
  const [clip, setClip] = useState(createClip);
  const [inFlight, setInFlight] = useState<Action | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!inFlight) {
      return;
    }
    const timer = window.setTimeout(() => setInFlight(null), RECEIPT_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [inFlight]);

  const run = useCallback(() => {
    const taken = availableAction(clip);
    setClip(advance);
    if (!reduced) {
      setInFlight(taken);
    }
  }, [clip, reduced]);

  const reset = useCallback(() => {
    setInFlight(null);
    setClip(createClip());
  }, []);

  const [outbound, inbound] = receipts(clip.phase);
  const move = nextMove(clip.phase);
  const busy = inFlight !== null;
  const activity = activityFor(inFlight);
  /** The column with the move lights up; once settled, the beneficiary holds the share. */
  const sendingIsUp = move?.actor === "chani" || move?.actor === "chani-institution";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-8 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="font-semibold text-[16px] tracking-[-0.02em]">Sietch</h1>
            <span className="text-[12px] text-muted-foreground">
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

      {/*
       * The room's one live region. Five of them used to fire per click, in undefined
       * order; this says the pair and what settle() did with it, once.
       */}
      <p className="sr-only" role="status">
        {announcement(clip.phase)}
      </p>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-8 pt-8 pb-16">
        {/* The stage: what is being delivered, and between whom. Amounts are public in v1. */}
        <p className="text-[13px] text-muted-foreground">
          {DELIVERY.amount} {DELIVERY.symbol} · {DELIVERY.sender} ({DELIVERY.senderBook}) →{" "}
          {DELIVERY.beneficiary} ({DELIVERY.beneficiaryBook})
        </p>

        <div className="mt-6">
          <BeatSpine phase={clip.phase} />
        </div>

        <div className="mt-9 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <InstitutionSlab receipt={outbound} active={sendingIsUp} activity={activity.outbound} />
          <Channel phase={clip.phase} busy={busy} />
          <InstitutionSlab
            receipt={inbound}
            active={!sendingIsUp}
            activity={activity.inbound}
            align="right"
          />
        </div>

        <div className="mt-8">
          <VerdictBand phase={clip.phase} busy={busy} onAdvance={run} />
        </div>

        <div className="mt-8">
          <PrivacyLedger phase={clip.phase} />
        </div>

        <div className="mt-10">
          <Transcript entries={history(clip.phase)} />
          <p className="mt-5 break-all font-mono text-[11px] text-muted-foreground">
            desk{" "}
            <a
              href={addressUrl(DESK)}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-border underline-offset-4 hover:text-foreground"
            >
              {DESK}
            </a>
            <br />
            vkey {PROGRAM_VKEY}
          </p>
        </div>
      </main>
    </div>
  );
}
