"use client";

import type { Phase } from "./clip";
import { moveLabel, nextMove, whoseMove } from "./clip";
import { channelNote } from "./settlement";

const SHARE_POSITION: Record<Phase, string> = {
  idle: "left-[2%]",
  pending: "left-[46%]",
  published: "left-[46%]",
  settled: "left-[92%]",
};

/**
 * The corridor between Chani and Paul, and the one control that moves the room.
 * The door is the beneficiary's inbound policy: the share sits against it until
 * v2 is in force. Pressing the control takes whatever move is open — no seat needed.
 */
export function Channel({
  phase,
  busy,
  onAdvance,
}: {
  phase: Phase;
  busy: boolean;
  onAdvance: () => void;
}) {
  const doorOpen = phase === "published" || phase === "settled";
  const move = nextMove(phase);

  return (
    <div className="flex min-w-[260px] flex-col items-center justify-center px-2 py-6">
      <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">the channel</p>

      <div aria-hidden className="relative mt-6 h-16 w-full">
        <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-border" />
        <div
          className={`absolute top-1/2 left-[46%] h-12 w-px -translate-x-1/2 -translate-y-1/2 transition-colors ${
            doorOpen ? "bg-success/40" : "bg-destructive/50"
          }`}
        />
        <div
          className={`absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-foreground/15 bg-primary font-mono text-[9px] transition-[left] duration-700 ease-out motion-reduce:transition-none ${
            SHARE_POSITION[phase]
          } ${busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
        >
          1 sh
        </div>
      </div>

      <p
        className={`mt-6 text-center text-[12px] ${doorOpen ? "text-success" : "text-muted-foreground"}`}
        aria-live="polite"
      >
        {channelNote(phase)}
      </p>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        the chain reads two receipts, never the clauses
      </p>

      <button
        type="button"
        disabled={!move || busy}
        onClick={onAdvance}
        className="mt-7 h-11 rounded-full border border-transparent bg-foreground px-6 text-[13.5px] text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
      >
        {moveLabel(phase)}
      </button>
      <p className="mt-2.5 text-center text-[11px] text-muted-foreground" aria-live="polite">
        {whoseMove(phase)}
      </p>
    </div>
  );
}
