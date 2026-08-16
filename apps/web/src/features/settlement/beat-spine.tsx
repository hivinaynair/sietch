import type { Phase } from "./clip";
import { beats } from "./narrative";

/**
 * Three beats, so a refusal reads as act one of a clip rather than a demo that broke.
 * Labels carry their own tense: a beat still ahead is an instruction, never a report.
 */
export function BeatSpine({ phase }: { phase: Phase }) {
  return (
    <ol aria-label="clip progress" className="flex items-center">
      {beats(phase).map((beat, i) => (
        <li key={beat.n} className="flex flex-1 items-center gap-3 last:flex-none">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[11px] ${
                beat.status === "done"
                  ? "bg-foreground text-background"
                  : beat.status === "current"
                    ? "bg-primary text-foreground ring-4 ring-primary/30"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {beat.n}
            </span>
            <span
              className={`whitespace-nowrap text-[12.5px] ${
                beat.status === "upcoming" ? "text-muted-foreground/60" : "text-foreground"
              }`}
            >
              {beat.label}
              <span className="sr-only">
                {beat.status === "done" ? " — done" : beat.status === "current" ? " — next" : ""}
              </span>
            </span>
          </span>
          {i < 2 && (
            <span
              aria-hidden
              className={`h-px flex-1 ${beat.status === "done" ? "bg-foreground/30" : "bg-border"}`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
