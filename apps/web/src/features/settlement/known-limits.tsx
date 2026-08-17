export type Limit = {
  id: string;
  title: string;
  /** What this clip actually does. */
  what: string;
  /** What a real desk does instead. */
  real: string;
};

/**
 * What this clip stubs, on the page rather than only in the repo.
 *
 * Kept in sync with the "Known limits" section of README.md by known-limits.test.ts.
 */
export const LIMITS: readonly Limit[] = [
  {
    id: "seal",
    title: "The v1 seal is enumerable",
    what: "Unsalted hash; under 200 guesses recover the clauses.",
    real: "policy_commitment in crates/policy; wiring it changes the vkey.",
  },
  {
    id: "token",
    title: "The receipts name a demo token id",
    what: "Both receipts commit 0x3333…; the proof is not bound to the asset that moves.",
    real: "Deploy the token first, then prove against its address.",
  },
  {
    id: "keys",
    title: "One operator key stands in for two institutions",
    what: "One clerk signs both calls; two receipts, one machine.",
    real: "Stdin is 146 bytes; a decode error if two policies are concatenated.",
  },
  {
    id: "proving",
    title: "Proving is precomputed, verification is live",
    what: "Four receipts were generated ahead of time; this page does not prove.",
    real: "Instant means two verifyProof calls, roughly 540k gas.",
  },
] as const;

/**
 * Same visual language as the privacy ledger — a dashed panel, four short rows.
 */
export function KnownLimits() {
  return (
    <section
      aria-label="known limits"
      className="rounded-xl border border-border border-dashed px-6 py-5 sm:px-8 sm:py-6"
    >
      <h2 className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
        known limits
      </h2>

      <ul className="mt-4 space-y-3">
        {LIMITS.map((limit) => (
          <li key={limit.id} className="text-[12.5px]">
            <span className="text-foreground">{limit.title}</span>
            <span className="text-muted-foreground">
              {": "}
              {limit.what} {limit.real}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
