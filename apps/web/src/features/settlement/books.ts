import type { Phase } from "./clip";
import type { Side } from "./settlement";

export type Books = {
  /** The instructed share, sitting on the desk until both receipts allow. */
  deskShares: number;
  /** Posted to Paul’s institution, not a customer wallet. */
  paulShares: number;
};

/** Tape follows the clip. Live passes the balances just read from the token. */
export function booksFor(phase: Phase, live?: Books): Books {
  if (live) {
    return live;
  }
  return phase === "settled" ? { deskShares: 0, paulShares: 1 } : { deskShares: 1, paulShares: 0 };
}

export function booksLabel(side: Side, shares: number): string {
  const noun = shares === 1 ? "share" : "shares";
  if (side === "outbound") {
    return `${shares} ${noun} on the desk`;
  }
  return `${shares} ${noun} on the books`;
}
