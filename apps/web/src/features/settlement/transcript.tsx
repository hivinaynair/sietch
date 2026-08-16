import { shortHash, txUrl } from "./chain";
import type { Entry } from "./settlement";

const TONE = {
  held: "text-destructive",
  settled: "text-success",
} as const;

/**
 * Append-only tape of what the chain saw. Publishing v2 never rewrites a refusal.
 * Transactions are links: the clip claims Base Sepolia, so a reader should be able to
 * leave the page and check it.
 */
export function Transcript({ entries }: { entries: readonly Entry[] }) {
  return (
    <section>
      <h2 className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
        On-chain transcript
      </h2>

      {entries.length === 0 ? (
        <p className="py-4 text-[13px] text-muted-foreground">
          Nothing on chain yet. Chani has not instructed.
        </p>
      ) : (
        <ol className="mt-4">
          {entries.map((entry) => (
            <li
              key={`${entry.at}-${entry.what}`}
              className="grid grid-cols-[54px_1fr] items-baseline gap-x-4 gap-y-1 border-border/70 border-b py-3 text-[12.5px] last:border-0 sm:grid-cols-[54px_190px_1fr_auto]"
            >
              <span className="font-mono text-[11px] text-muted-foreground">{entry.at}</span>
              <span className="text-muted-foreground">{entry.who}</span>
              <span className={`col-start-2 sm:col-start-3 ${entry.tone ? TONE[entry.tone] : ""}`}>
                {entry.what}
              </span>
              <span className="col-start-2 font-mono text-[11px] sm:col-start-4">
                {entry.tx ? (
                  <a
                    href={txUrl(entry.tx)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                  >
                    {shortHash(entry.tx)} ↗
                  </a>
                ) : (
                  <span className="text-muted-foreground">{entry.hash ?? ""}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
