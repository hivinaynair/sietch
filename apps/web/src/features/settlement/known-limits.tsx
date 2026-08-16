export type Limit = {
  id: string;
  title: string;
  /** What this clip actually does. Never softened — the reader can check all four. */
  what: string;
  /** What a real desk does instead, specifically enough to be argued with. */
  real: string;
};

/**
 * What this clip stubs, on the page rather than only in the repo.
 *
 * The reader who opens the URL and not the repo is the reader most likely to take the strong
 * claims at face value, so the stubs belong where the claims are. Each row is one thing a
 * careful reader would find anyway; finding it here first is the point.
 *
 * Kept in sync with the "Known limits" section of README.md by known-limits.test.ts.
 */
export const LIMITS: readonly Limit[] = [
  {
    id: "seal",
    title: "The v1 seal is enumerable",
    what: "A policy is a u64 ceiling and one flag, hashed with no blinding factor. Under 200 guesses recover it from the seal the desk stores, so v1 hides the clauses from a casual reader and not from an interested one.",
    real: "Commit to blinding ‖ clauses, with the blinding factor carried in stdin next to the policy. Implemented and tested as policy_commitment in crates/policy, including the sweep that breaks v1 and the same sweep failing against the commitment. Wiring it changes the guest ELF and therefore the vkey, which would invalidate the four committed receipts.",
  },
  {
    id: "token",
    title: "The receipts name a demo token id",
    what: "Both receipts commit token 0x3333…3333. The desk moves a separately deployed sTBILL and checks the committed id against that constant, so the proof is not bound to the asset that actually moves.",
    real: "Deploy the token first, prove against its address, then deploy the desk. Ordering only — the guest already takes the token as a public input, so nothing about the design changes.",
  },
  {
    id: "keys",
    title: "One operator key stands in for two institutions",
    what: "The institutions are 0x1111… and 0x2222…, which nobody holds, and a single demo clerk signs both settle() and publishInbound(). Two receipts were generated on one machine.",
    real: "Each institution proves locally and signs its own publish. The isolation this clip does enforce is stdin discipline: one policy per execute, a fixed 146-byte buffer, and a decode error if a caller ever concatenates two policies — see STDIN_LEN in crates/policy-guest.",
  },
  {
    id: "proving",
    title: "Proving is precomputed, verification is live",
    what: "Four Groth16 receipts were generated ahead of time. The control on this page runs settle() and publishInbound() against Base Sepolia now; it does not prove anything in your browser.",
    real: "Instant means verify at settlement — two verifyProof calls, roughly 540k gas plus the transfer. That number is the argument for a native verifier in the chain rather than a contract above it; the README says what it would take to reach the throughput Metal is aiming at.",
  },
] as const;

/**
 * Same visual language as the privacy ledger — this is the third column of the same claim,
 * not an apology appended to it.
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
      <p className="mt-3 max-w-3xl text-[12.5px] text-muted-foreground">
        Four things this clip stubs. A production desk closes all four; none of them are hidden
        behind a hand-wave here.
      </p>

      <ul className="mt-6 space-y-6">
        {LIMITS.map((limit) => (
          <li key={limit.id} className="border-border border-t pt-5 first:border-t-0 first:pt-0">
            <p className="text-[13.5px]">{limit.title}</p>
            <div className="mt-2.5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <p className="max-w-prose text-[12.5px] text-muted-foreground">
                <span className="text-foreground">in this clip · </span>
                {limit.what}
              </p>
              <p className="max-w-prose text-[12.5px] text-muted-foreground">
                <span className="text-foreground">in a real deployment · </span>
                {limit.real}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
