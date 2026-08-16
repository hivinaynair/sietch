# Sietch Demo Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Sietch clip survive a hostile, crypto-literate read: no false privacy claims on the page, the four known stubs named precisely with the fix demonstrated in tested code, a demo that can always tell its story, and docs that stand on their own.

**Architecture:** Three constraints shape everything. (1) The four committed Groth16 receipts are **not** being regenerated, so `crates/policy-guest` and `crates/policy`'s existing `policy_hash` are frozen — the salted commitment lands as a **new, tested, deliberately unwired** `v2` function plus honest disclosure, not as a silent guest change. (2) The receipts bind vkey / orgs / token-id / policy-hashes / transferIds but **not the desk address**, so `Desk` can be redeployed freely — that is how the one-shot demo gets re-armed, with no contract changes and no re-verification. (3) Phase becomes **contract-state-derived** (`usedTransfer`, `policyHashOf`) with events used only for display tx hashes, which kills the 9000-block window bug; a tape fallback guarantees the story is tellable even when the live desk is spent.

**Tech Stack:** Rust (`sietch-policy`, `tiny-keccak`, `rstest`), Foundry (`Desk.sol`, unchanged), Next.js App Router + Bun test in `apps/web`, viem against Base Sepolia, Vercel.

**Out of scope (explicit):** regenerating proofs, changing the guest ELF or vkey, changing `Desk.sol`, adding a fifth actor, customer identity.

**PATH note:** every Rust/Foundry command below needs
`export PATH="$HOME/.sp1/bin:$HOME/.foundry/bin:$PATH"` — this shell does not source the user profile.

---

## Phase 1 — Stop the page from lying

The privacy ledger currently asserts "Two policy hashes — **the seal, not the clauses**." For a 64-byte, two-field policy with no blinding factor, the hash *is* the clauses. This phase removes every false claim and replaces it with a checkable one.

### Task 1: The enumeration attack, as a test

Prove the v1 commitment is broken, in the repo, before claiming anything about it.

**Files:**
- Modify: `crates/policy/src/lib.rs`
- Test: `crates/policy/src/lib.rs` (inline `mod tests`, matching existing convention)

**Step 1: Write the failing test**

Add to `mod tests`:

```rust
    /// The v1 seal is not a commitment. `max_amount` is a u64 and `accepts_cross_border`
    /// is one bool, so an observer who reads a policy hash off the chain can recover the
    /// clauses by enumeration. This test *is* the attack: it succeeds, and that is the
    /// finding. `policy_commitment` is the fix; see `blinding_defeats_enumeration`.
    #[test]
    fn v1_hash_falls_to_enumeration() {
        let secret = Policy { max_amount: 10, accepts_cross_border: false };
        let seal = policy_hash(&secret);

        let mut recovered = None;
        for max_amount in 0..=64u64 {
            for accepts_cross_border in [false, true] {
                let guess = Policy { max_amount, accepts_cross_border };
                if policy_hash(&guess) == seal {
                    recovered = Some(guess);
                }
            }
        }

        assert_eq!(recovered, Some(secret), "the v1 seal leaks its clauses");
    }
```

**Step 2: Run it and confirm it passes**

Run: `export PATH="$HOME/.sp1/bin:$HOME/.foundry/bin:$PATH" && cargo test -p sietch-policy v1_hash_falls_to_enumeration -- --nocapture`
Expected: PASS. (Unusual for a TDD step — the point of this test is to *document a defect*, so green means the defect is real and now guarded against silent "fixes" that don't fix it.)

**Step 3: Commit**

```bash
git add crates/policy/src/lib.rs
git commit -m "Show the v1 seal leaking: 130 guesses recover the clauses."
```

### Task 2: The salted commitment (v2, unwired)

**Files:**
- Modify: `crates/policy/src/lib.rs`

**Step 1: Write the failing tests**

```rust
    #[test]
    fn blinding_defeats_enumeration() {
        let secret = Policy { max_amount: 10, accepts_cross_border: false };
        let blinding = [7u8; 32];
        let sealed = policy_commitment(&secret, &blinding);

        for max_amount in 0..=64u64 {
            for accepts_cross_border in [false, true] {
                let guess = Policy { max_amount, accepts_cross_border };
                assert_ne!(policy_commitment(&guess, &[0u8; 32]), sealed);
            }
        }
    }

    #[test]
    fn same_policy_two_versions_two_commitments() {
        let policy = Policy { max_amount: 10, accepts_cross_border: false };
        assert_ne!(
            policy_commitment(&policy, &[1u8; 32]),
            policy_commitment(&policy, &[2u8; 32])
        );
    }

    #[test]
    fn two_institutions_never_share_a_commitment() {
        // The v1 clip shows one hash under both institutions because both v1 policies are
        // byte-identical. Per-institution blinding is what stops that.
        let identical = Policy { max_amount: 10, accepts_cross_border: false };
        assert_ne!(
            policy_commitment(&identical, &[0xAA; 32]),
            policy_commitment(&identical, &[0xBB; 32])
        );
    }
```

**Step 2: Run to verify failure**

Run: `cargo test -p sietch-policy commitment 2>&1 | tail -5`
Expected: FAIL, `cannot find function 'policy_commitment'`

**Step 3: Minimal implementation**

Add next to `policy_hash`:

```rust
/// Hiding commitment to one institution's clauses: `keccak(blinding ‖ policy_bytes)`.
///
/// `policy_hash` (v1, what the recorded clip actually published) is unsalted keccak over
/// 64 bytes holding a `u64` and a bool. That domain is small enough to enumerate, so the
/// v1 seal reveals the clauses it was supposed to hide — see `v1_hash_falls_to_enumeration`.
/// `blinding` is a per-institution, per-version secret carried in stdin beside the policy.
/// It never reaches the chain, so the commitment is opaque even when the clauses are guessable.
///
/// **Not wired into the guest.** Switching the guest to this changes the ELF and therefore
/// the vkey, which invalidates the four committed Groth16 receipts. README "Known limits"
/// records that as the one-reprove fix.
pub fn policy_commitment(policy: &Policy, blinding: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    hasher.update(blinding);
    hasher.update(&policy_bytes(policy));
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}
```

**Step 4: Run to verify pass**

Run: `cargo test -p sietch-policy 2>&1 | tail -5`
Expected: all PASS.

**Step 5: Commit**

```bash
git add crates/policy/src/lib.rs
git commit -m "Add the blinded commitment the seal should have been, with the attack it stops."
```

### Task 3: Rewrite the privacy ledger so every line is true

`ledger()` in `apps/web/src/features/settlement/narrative.ts:120-145` claims the hash hides the clauses. It does not.

**Files:**
- Modify: `apps/web/src/features/settlement/narrative.ts`
- Test: `apps/web/src/features/settlement/narrative.test.ts`

**Step 1: Write the failing test**

```ts
test("the ledger never claims the seal hides the clauses", () => {
  for (const phase of PHASES) {
    const { read, never } = ledger(phase);
    const all = [...read, ...never].join(" ");
    expect(all).not.toContain("the seal, not the clauses");
  }
});

test("the chain-read column admits the seal is enumerable", () => {
  const { read } = ledger("pending");
  expect(read.join(" ")).toMatch(/enumerab|recoverab|guessab/i);
});

test("what the chain never saw does not overclaim past the known limits", () => {
  const { never } = ledger("settled");
  // The other institution's policy really is isolated (fixed-length stdin, decode error
  // on concatenation). That claim stays. Clause secrecy does not.
  expect(never.join(" ")).toContain("one policy per stdin");
});
```

**Step 2: Run to verify failure**

Run: `bun test apps/web/src/features/settlement/narrative.test.ts`
Expected: FAIL on the "enumerable" assertion.

**Step 3: Rewrite `ledger()`**

```ts
export function ledger(phase: Phase): Ledger {
  const never = [
    "The other institution’s policy — one policy per stdin, never both",
    "Which clause stopped the delivery — no reason field is emitted",
    "Any clause bytes in calldata, an event, or this page",
  ] as const;

  if (phase === "idle") {
    return { read: ["Nothing yet — Chani has not instructed"], never };
  }

  const read = [
    "Two booleans: outbound allowed, inbound allowed",
    "Two policy hashes — and v1’s hash is enumerable, so treat it as public. See Known limits",
    "Chani, Paul, both institutions, token, amount",
    "One transfer id per attempt, consumed once",
  ];

  return {
    read: phase === "settled" ? [...read, "That both receipts verified for this vkey"] : read,
    never,
  };
}
```

Update the doc comment above `ledger` to say the second column is scoped to *isolation and reasons*, not clause secrecy.

**Step 4: Run to verify pass**

Run: `bun test apps/web/src/features/settlement/narrative.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/features/settlement/narrative.ts apps/web/src/features/settlement/narrative.test.ts
git commit -m "Say the v1 seal is enumerable; keep only the isolation claim that holds."
```

### Task 4: A "Known limits" panel on the page

The four stubs, on screen, in the reader's path — not buried in a repo he may not open.

**Files:**
- Create: `apps/web/src/features/settlement/known-limits.tsx`
- Create: `apps/web/src/features/settlement/known-limits.test.ts`
- Modify: `apps/web/src/features/settlement/settlement-room.tsx`

**Step 1: Write the failing test**

```ts
import { LIMITS } from "./known-limits";

test("every limit names the stub and what a real deployment does instead", () => {
  expect(LIMITS.length).toBe(4);
  for (const limit of LIMITS) {
    expect(limit.what.length).toBeGreaterThan(20);
    expect(limit.real.length).toBeGreaterThan(20);
  }
});

test("the limits cover all four known stubs", () => {
  const ids = LIMITS.map((l) => l.id);
  expect(ids).toEqual(["seal", "token", "keys", "proving"]);
});
```

**Step 2: Run to verify failure** — module not found.

**Step 3: Implement**

```tsx
export type Limit = { id: string; title: string; what: string; real: string };

/**
 * What this clip stubs. On the page rather than in the repo, because the reader who only
 * opens the URL is the reader most likely to take the strong claims at face value.
 */
export const LIMITS: readonly Limit[] = [
  {
    id: "seal",
    title: "The v1 seal is enumerable",
    what: "A policy is a u64 ceiling and one bool, hashed unsalted. 130 guesses recover it from the hash the chain stores.",
    real: "Commit to blinding ‖ clauses, with the blinding factor in stdin. Implemented and tested as policy_commitment; wiring it changes the ELF, so the recorded receipts would need reproving.",
  },
  {
    id: "token",
    title: "The receipts name a demo token id",
    what: "Both receipts commit token 0x3333…3333. The desk moves a separately deployed sTBILL and checks that id, so the proof is not bound to the asset that moves.",
    real: "Deploy the token first, prove against its address, then deploy the desk. Ordering only — no design change.",
  },
  {
    id: "keys",
    title: "One operator key stands in for two institutions",
    what: "The institutions are 0x1111… and 0x2222…, which nobody holds, and a single demo clerk signs settle() and publishInbound().",
    real: "Each institution proves locally and signs its own publish. The isolation this clip does enforce is stdin: one policy per execute, a fixed 146-byte buffer, decode error on concatenation.",
  },
  {
    id: "proving",
    title: "Proving is precomputed",
    what: "Four Groth16 receipts were generated ahead of time. The click runs settle() and publishInbound() live; it does not prove in your browser.",
    real: "Instant means verify at settlement — two verifyProof calls, ~540k gas. See README for why that number is the argument for putting this in the chain rather than above it.",
  },
] as const;
```

Render as a bordered section titled `known limits`, each row `title` / `what` / `real` labelled *in this clip* and *in a real deployment*. Reuse the existing `PrivacyLedger` visual language (`rounded-xl border border-border`, `text-[11px] uppercase tracking-[0.14em]` heading, `text-[12.5px]` body).

**Step 4: Mount it** in `settlement-room.tsx` directly under `<PrivacyLedger />`, above `<Transcript />`.

**Step 5: Run tests + commit**

```bash
bun test apps/web/src/features/settlement/
git add apps/web/src/features/settlement/known-limits.tsx apps/web/src/features/settlement/known-limits.test.ts apps/web/src/features/settlement/settlement-room.tsx
git commit -m "Put the four stubs on the page: what this clip fakes, what a real desk does."
```

### Task 5: Label the shared v1 hash instead of letting it read as a bug

Both institutions render `0x3e9a…3dc4` because both v1 policies are byte-identical.

**Files:**
- Modify: `apps/web/src/features/settlement/settlement.ts` (add `sealNote` to `Receipt`)
- Modify: `apps/web/src/features/settlement/institution-slab.tsx` (`SealedPolicy`)
- Test: `apps/web/src/features/settlement/settlement.test.ts`

**Step 1: Failing test**

```ts
test("the matching v1 seals are called out, not left looking like a bug", () => {
  const [outbound, inbound] = receipts("pending");
  expect(outbound.policyHash).toBe(inbound.policyHash);
  expect(outbound.sealNote).toMatch(/identical/i);
  expect(inbound.sealNote).toMatch(/identical/i);
});

test("once inbound v2 is published the seals diverge and the note clears", () => {
  const [outbound, inbound] = receipts("settled");
  expect(outbound.policyHash).not.toBe(inbound.policyHash);
  expect(inbound.sealNote).toBeNull();
});
```

**Step 2–4:** add `sealNote: string | null` to `Receipt`; set it to
`"same seal both sides — v1 clauses are identical here, and an unsalted hash of identical clauses matches"` while `phase` is `idle`/`pending`, `null` once `inboundV2` is true. Render under the hash in `SealedPolicy` at `text-[11px] text-muted-foreground`.

**Step 5: Commit**

```bash
git commit -am "Name the matching v1 seals so the collision reads as arithmetic, not a bug."
```

---

## Phase 2 — A demo that can always tell its story

### Task 6: Derive phase from contract state, not the event window

`readFacts` scans from `latest - 9000` (≈5h on Base) when `SIETCH_FROM_BLOCK` is unset, so a spent desk reads back as `idle`, re-enables the button, and reverts.

**Files:**
- Modify: `apps/web/src/features/settlement/desk-phase.ts`
- Modify: `apps/web/src/features/settlement/desk-live.ts`
- Modify: `apps/web/src/features/settlement/desk-abi.ts` (add `usedTransfer`)
- Test: `apps/web/src/features/settlement/desk-phase.test.ts`

**Step 1: Failing tests**

```ts
test("a settled desk stays settled after its events age out of the window", () => {
  expect(
    phaseFromDesk({
      inboundHash: POLICY_HASH_V2,
      attemptTwoUsed: true,
      // no tx hashes at all — the log window has moved past them
    }),
  ).toBe("settled");
});

test("a published desk stays published without the pending event", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V2, attemptTwoUsed: false })).toBe("published");
});

test("balances decide settled even if the inbound hash was republished", () => {
  expect(
    phaseFromDesk({ inboundHash: POLICY_HASH_V1, attemptTwoUsed: true }),
  ).toBe("settled");
});

test("a fresh desk with no events and v1 in force is idle", () => {
  expect(phaseFromDesk({ inboundHash: POLICY_HASH_V1, attemptTwoUsed: false })).toBe("idle");
});
```

**Step 2–3:** extend `DeskFacts` with `attemptTwoUsed: boolean`, and reorder `phaseFromDesk`:

```ts
export function phaseFromDesk(facts: DeskFacts): Phase {
  if (facts.attemptTwoUsed || facts.settleForPaulTx) return "settled";
  if (norm(facts.inboundHash) === norm(POLICY_HASH_V2)) return "published";
  if (facts.settlePendingTx) return "pending";
  return "idle";
}
```

State first, events only for the `pending` beat (which has no state footprint) and for display hashes. In `desk-live.ts`, read `usedTransfer(TRANSFER_ATTEMPT_2)` alongside the other calls, and default `fromBlock` to `SIETCH_FROM_BLOCK` ?? the desk deploy block from `chain.json` ?? `0n` — never a sliding window.

**Step 4–5:** `bun test apps/web/` then commit.

### Task 7: Tape fallback — the story is always tellable

**Files:**
- Modify: `apps/web/src/features/settlement/settlement-room.tsx`
- Modify: `apps/web/src/app/api/clip/advance/route.ts`
- Test: `apps/web/src/features/settlement/clip.test.ts`

Behaviour:
- Live desk `settled` **or** any advance error → surface a `Replay the tape` control that drops the room into local-state tape mode (`setClip(createClip())`, `setLive({...live, live: false})`), header reads `· tape`, transcript links the historical `CLIP_TX` hashes from `chain.json`.
- Tape mode keeps the existing `Reset`.
- One line of copy when tape is showing: `Replaying the recorded clip. The live desk at 0x… has already settled; its transactions are linked below.` Never silently pretend a tape click is a chain write.

**Test:** advancing past `settled` yields no move (`nextMove("settled") === null`) and the room exposes a replay affordance; assert the copy names the tape.

**Commit:** `"Give the room a tape to fall back on so a spent desk still tells the story."`

### Task 8: Rate-limit the advance route

Unauthenticated `POST /api/clip/advance` spends the operator's gas key.

**Files:**
- Create: `apps/web/src/features/settlement/rate-limit.ts` + test
- Modify: `apps/web/src/app/api/clip/advance/route.ts`

In-memory fixed window keyed by `x-forwarded-for`: 5 writes / 10 min per IP, plus a global 20 / 10 min ceiling. Return 429 with `{ error: "too many settlements, try again shortly" }`. Test the window boundary and the global ceiling with an injected clock. Commit.

### Task 9: `bun run rearm` — one command to re-arm the clip

The receipts do not bind the desk address, so a fresh `Desk` restores `usedTransfer` and the v1 inbound hash. `TBill.mint` is permissionless, so the existing token is reused.

**Files:**
- Create: `contracts/script/Rearm.s.sol`
- Create: `scripts/rearm.mjs`
- Modify: `package.json` (`"rearm": "bun scripts/rearm.mjs"`)
- Modify: `artifacts/demo/chain.json` (written by the script)

`Rearm.s.sol` deploys only `Desk` against `vm.envAddress("TBILL")` with the v1 hashes, then `TBill(tbill).mint(address(desk), 1)`. `scripts/rearm.mjs` runs forge, parses the new address, rewrites `chain.json` (`desk`, `deploy.desk`, `deploy.mint`, clears `clip.*`), and prints the exact
`vercel env rm SIETCH_DESK_ADDRESS production && vercel env add SIETCH_DESK_ADDRESS production` pair to run. It must **not** write Vercel env itself. Document in README under "Operating the clip". Commit.

### Task 10: Mobile — control above the fold

At 375px the single control sits ~3 screens down, past a full-height Chani card.

**Files:**
- Modify: `apps/web/src/features/settlement/settlement-room.tsx`

Order on small screens: stage line → beat spine → **verdict band (with the control)** → institution slabs → channel → privacy ledger → known limits → transcript. Desktop order unchanged. Use CSS order on a flex/grid container (`order-1 lg:order-2` style) rather than duplicating the band — one DOM node, so no double live-region announcements. Also give `SealedPolicy`'s bar `aria-hidden` a `sealed` text label so it does not read as a loading skeleton, and shorten the slab vertical padding under `sm`.

**Verify:** `resize_window` to mobile, screenshot, confirm the button is visible without scrolling past one card. Commit.

---

## Phase 3 — Docs that stand on their own

### Task 11: Scrub the design doc

**Files:** `docs/plans/2026-08-15-sietch-design.md`

Remove reader-targeting language so the doc reads as engineering, not as a pitch aimed at a named person: "job-application demo for Metal (Loong)" → "a demonstration of one Metal primitive"; "**He will know**" → "an informed reader will check"; "If Loong hates trusted setups" → "if the trusted setup is unacceptable"; "Loong sits here" → "this is the seat the demo defaults to". Keep every technical decision, the threat model, and the rejected-options table verbatim. Commit.

### Task 12: Rewrite the README

**Files:** `README.md`

Sections, in order:
1. Claim in one sentence + live link.
2. **Unofficial project disclaimer**, matching bare-metal's wording: inspired by Metal's public thesis, not affiliated or endorsed.
3. What the chain sees vs. does not (scoped to isolation and reasons — no clause-secrecy claim).
4. Two receipts, one settlement — the isolation mechanism, `STDIN_LEN = 146`, decode error on concatenation.
5. **Known limits** — the same four entries as `known-limits.tsx`, kept in prose. Add a test asserting the four ids appear in `README.md` so they cannot drift apart.
6. **What this would cost on Metal** — two `verifyProof` calls ≈ 540k gas + transfer, per settlement, with precomputed proving; state plainly that this does not reach "millions per second" or "a cent or less", and that the path is one aggregate receipt (recursion) or a native verifier precompile — which is the argument for building it into the chain rather than above it.
7. Operating the clip — `bun run rearm`, `SIETCH_FROM_BLOCK`, tape mode.
8. Layout / commands (keep existing).
9. **Related:** link `hivinaynair/metal` (bare-metal) as the companion — enforcement *before* funds move (agentic pillar) vs. enforcement *without disclosure* (institutional pillar).

Commit.

### Task 13: Cross-link from bare-metal

**Files:** `/Users/vinay/code/metal/README.md`

Add a `Related` line pointing at Sietch, framing the pair as two Metal pillars rather than two attempts at one. Separate repo → separate commit there. Commit.

### Task 14: Reconcile the deployment record

`artifacts/demo/chain.json` names desk `0xF948…dFA7`; the live page drives `0x94D3B70D…`.

**Files:** `artifacts/demo/chain.json`, `artifacts/demo/README.md`, `apps/web/src/features/settlement/settlement.ts`, `apps/web/src/features/settlement/chain.test.ts`

Point `chain.json` at whatever desk is actually live, regenerate the tape tx hashes from that desk's events (or blank `clip.*` and let tape mode fall back to "not yet run on this desk"), and extend `chain.test.ts` with a test that the `DESK` constant equals `chain.json.desk`. Note in `artifacts/demo/README.md` that `chain.json` is the record for the **current** desk and that `bun run rearm` rewrites it.

---

## Phase 4 — Verify and ship

### Task 15: Full local verification

Run and paste real output for each:

```bash
export PATH="$HOME/.sp1/bin:$HOME/.foundry/bin:$PATH"
cargo test --workspace
forge test --root contracts
bun test
bun run check-types
bun run check-boundaries
bun run format-and-lint
```

All must pass before any deploy. @superpowers:verification-before-completion

### Task 16: Re-arm on chain and verify live

Requires the clerk key already in `apps/web/.env.local` and Base Sepolia gas. **Confirm with the user before broadcasting** — this is an outward-facing chain write.

1. `bun run rearm` → new desk address.
2. User sets `SIETCH_DESK_ADDRESS` in Vercel production with the printed commands.
3. Redeploy, then verify in the browser: header `live`, phase `idle`, desk link matches `chain.json`, known-limits panel present, mobile control above the fold.
4. Walk the clip once **on a throwaway desk** to confirm all three beats and the settled state, then `bun run rearm` again so the founder-facing URL is armed at beat 1.

### Task 17: Hand the visibility switch back

Report the scrub diff, then leave the flip to the user:

```bash
gh repo edit hivinaynair/sietch --visibility public
```

Do **not** run it.

---

## Unresolved questions

1. Repro path for the four proofs — README says reproducible; with `cargo-prove` off PATH and Docker down, should it document the Succinct-network route as primary?
2. Keep the Dune vocabulary (desk / book / channel / seal / room), or gloss each on first use?
3. Tape mode default: fall back automatically when the live desk is spent, or make the reader press `Replay the tape`?
4. Want a short "what I'd own in six months" note in the README, or does that belong in the email rather than the repo?
