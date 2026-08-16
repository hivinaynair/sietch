import type { Phase } from "./clip";
import { ledger } from "./narrative";

/**
 * The claim, made checkable at every beat: what the chain took from this settlement
 * against what it still cannot read. Stated side by side because the second column is
 * the product, and a viewer who only reads the first one has missed it.
 */
export function PrivacyLedger({ phase }: { phase: Phase }) {
  const { read, never } = ledger(phase);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="rounded-xl border border-border bg-muted/40 px-6 py-5">
        <h2 className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
          the chain read
        </h2>
        <ul className="mt-3 space-y-1.5">
          {read.map((line) => (
            <li key={line} className="text-[12.5px]">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border border-dashed px-6 py-5">
        <h2 className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
          the chain never saw
        </h2>
        <ul className="mt-3 space-y-1.5">
          {never.map((line) => (
            <li key={line} className="text-[12.5px] text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
