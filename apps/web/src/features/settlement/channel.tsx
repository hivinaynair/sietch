"use client";

import type { Phase } from "./clip";
import { channelNote } from "./settlement";

/**
 * The share parks clear of the door rather than on top of it. The door's state is the
 * one thing this diagram exists to show, and a puck centred on it hid exactly that in
 * the two phases where it carried meaning.
 */
const SHARE_POSITION: Record<Phase, string> = {
  idle: "left-[4%]",
  pending: "left-[34%]",
  published: "left-[34%]",
  settled: "left-[92%]",
};

/**
 * The corridor between Chani and Paul. The door is the beneficiary's inbound policy:
 * the share sits against it until v2 is in force. The move that opens it lives in the
 * verdict band, under the sentence it changes.
 */
export function Channel({ phase, busy }: { phase: Phase; busy: boolean }) {
  const doorOpen = phase === "published" || phase === "settled";

  return (
    <div className="flex min-w-[220px] flex-col items-center justify-center px-2 py-6">
      <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">the channel</p>

      <div aria-hidden className="relative mt-7 h-16 w-full">
        <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-border" />
        <div
          className={`absolute top-1/2 left-1/2 h-14 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
            doorOpen ? "bg-success" : "bg-destructive"
          }`}
        />
        <div
          className={`absolute top-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-foreground/15 bg-primary font-mono text-[9px] transition-[left] duration-700 ease-out motion-reduce:transition-none ${
            SHARE_POSITION[phase]
          } ${busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
        >
          1 sh
        </div>
      </div>

      <p
        className={`mt-6 text-center text-[12px] ${doorOpen ? "text-success" : "text-muted-foreground"}`}
      >
        {channelNote(phase)}
      </p>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        the chain reads two receipts, one per institution
      </p>
    </div>
  );
}
