"use client";

import { shortHash, txUrl } from "./chain";
import { moveLabel, nextMove, type Phase, roomCopy, whoseMove } from "./clip";
import { type Operand, settlement, whatJustHappened } from "./narrative";

const TONE = {
  idle: "text-muted-foreground",
  held: "text-destructive",
  settled: "text-success",
} as const;

function mark(allowed: boolean | null): string {
  return allowed === null ? "—" : allowed ? "✓" : "✗";
}

function Side({ operand }: { operand: Operand }) {
  return (
    <span className="flex items-baseline gap-2.5">
      <span
        aria-hidden
        className={`font-mono text-[15px] ${
          operand.allowed === null
            ? "text-muted-foreground"
            : operand.allowed
              ? "text-success"
              : "text-destructive"
        }`}
      >
        {mark(operand.allowed)}
      </span>
      <span className="text-[13.5px]">{operand.side}</span>
      <span className="text-[12px] text-muted-foreground">{operand.issuer}</span>
      {operand.historic && <span className="text-[11.5px] text-muted-foreground">attempt 1</span>}
    </span>
  );
}

/**
 * One zone that answers what happened and what settle() did with it, so the AND of the two
 * receipts is read as an operation rather than taken on trust. The control lives here too:
 * the thing you press sits under the sentence it will change.
 */
export function VerdictBand({
  phase,
  busy,
  onAdvance,
}: {
  phase: Phase;
  busy: boolean;
  onAdvance: () => void;
}) {
  const result = settlement(phase);
  const move = nextMove(phase);

  return (
    <section aria-label="settlement" className="rounded-xl border border-border bg-card px-8 py-7">
      <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
        what just happened
      </p>
      <p className="mt-3 max-w-2xl font-heading text-[26px] leading-[1.2] tracking-[-0.02em]">
        {roomCopy(phase)}
      </p>
      <p className="mt-2.5 max-w-2xl text-[13px] text-muted-foreground">
        {whatJustHappened(phase)}
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-border border-t pt-6">
        <Side operand={result.outbound} />
        <span className="font-mono text-[12px] text-muted-foreground">AND</span>
        <Side operand={result.inbound} />
        <span aria-hidden className="font-mono text-[13px] text-muted-foreground">
          →
        </span>
        <span className={`text-[13.5px] ${TONE[result.tone]}`}>{result.outcome}</span>
        {result.tx && (
          <a
            href={txUrl(result.tx)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            {shortHash(result.tx)} ↗
          </a>
        )}
      </div>

      {result.footnote && (
        <p className="mt-4 max-w-2xl text-[12.5px] text-muted-foreground">{result.footnote}</p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-5 border-border border-t pt-6">
        <button
          type="button"
          disabled={!move || busy}
          onClick={onAdvance}
          className="h-11 rounded-full bg-foreground px-6 text-[13.5px] text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {moveLabel(phase)}
        </button>
        <span className="text-[12px] text-muted-foreground">{whoseMove(phase)}</span>
      </div>
    </section>
  );
}
