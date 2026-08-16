# Sietch

**Two institutions settle a tokenized T-bill. Each proves its own policy allowed it. The chain verifies both receipts and moves the share — without either institution's rulebook being transmitted.**

**[Live clip →](https://sietch-plum.vercel.app/)**

> Unofficial project inspired by Metal's public thesis. Not affiliated with, endorsed by, or reviewed by Metal.

Not a chain. A stand-in for inter-institutional settlement: a Next.js settlement room plus a tiny SP1 policy guest — **one program, two executes** — verified through Succinct's canonical Groth16 gateway on Base Sepolia.

Read the four **[Known limits](#known-limits)** before the claims. They are on the live page too.

---

## The problem this is aimed at

When funds don't settle instantly, the delay often isn't the rails — it's the AML and fraud policy of the *beneficiary's* institution. So an institution's policy has to run as part of settlement. But if policy runs on-chain, the network processes your policy logic, and the usual answer is a private subnet run by a small operator set — where **the operators can see everything**.

Sietch answers exactly that: policy enforced at settlement, with no operator who reads both rulebooks.

## Two receipts, one settlement

One guest program. It runs **twice** per settlement, once per institution. Each run's private input is **only that institution's** policy.

```
Chani's institution          Paul's institution
  outbound policy              inbound policy
       │                            │
   execute #1                  execute #2        ← separate stdin, separate receipt
       │                            │
   receipt A                    receipt B
       └──────────┬─────────────────┘
              settle()
        verifyProof(A) ∧ verifyProof(B)
                  │
        both allowed? move the share : emit and stop
```

The isolation is **mechanical, not narrated**. Stdin is a fixed 146-byte buffer (`STDIN_LEN`, `crates/policy-guest`). Concatenating two policies is `2 × STDIN_LEN` and fails to decode. A test helper cannot quietly hand the guest both rulebooks.

`side` (outbound = 0, inbound = 1) is bound in the public values, so a sender receipt cannot be replayed as a receiver receipt. `transferId` is consumed once, so a passing pair cannot move the share twice.

### What settlement disclosed

Two booleans (outbound allowed, inbound allowed) · two policy seals · both institutions, the token, the amount · one transfer id per attempt · that both receipts verified for this vkey.

### What stayed off the wire

The other institution's policy — one policy per stdin, never both · which clause refused the delivery, since the desk emits **no reason field** · the clauses in bytes; only their seals were transmitted.

**Withheld from the wire is not the same as hidden.** See the first known limit.

---

## Known limits

Four things this clip stubs. All four are stated on the live page as well.

### The v1 seal is enumerable

A policy is a `u64` ceiling and one flag, hashed with no blinding factor. Under 200 guesses recover it from the seal the desk stores — `v1_hash_falls_to_enumeration` in `crates/policy` **is** that attack, and it passes. So v1 hides the clauses from a casual reader and not from an interested one. It also means two institutions holding identical clauses publish an identical seal, which is why the clip shows one hash under both sides at v1.

The fix is a hiding commitment: `keccak(blinding ‖ clauses)`, with the blinding factor carried in stdin next to the policy. Implemented and tested as `policy_commitment`, together with the sweep that breaks v1 failing against it. It is **deliberately not wired into the guest**: doing so changes the ELF and therefore the vkey, which would invalidate the four committed Groth16 receipts. One reprove away, not one redesign away.

### The receipts name a demo token id

Both receipts commit token `0x3333…3333`. The desk moves a separately deployed `sTBILL` and checks the committed id against that constant, so the proof is **not bound to the asset that actually moves**.

Fix is ordering, not design: deploy the token, prove against its address, then deploy the desk. The guest already takes the token as a public input.

### One operator key stands in for two institutions

The institutions are `0x1111…` and `0x2222…`, which nobody holds, and a single demo clerk signs both `settle()` and `publishInbound()`. Both receipts were generated on one machine.

Production has each institution prove locally and sign its own publish. What this clip *does* enforce is stdin discipline, above.

### Proving is precomputed, verification is live

Four Groth16 receipts were generated ahead of time. The control on the page runs `settle()` and `publishInbound()` against Base Sepolia **now** — it does not prove anything in your browser. "Instant" means verify at settlement, never prove in the tab.

Also disclosed: Groth16 carries a trusted setup (Aztec Ignition + Succinct entropy). Amounts and parties are public in v1; this demo answers **policy** privacy, not activity privacy.

---

## What this would cost, and why it belongs lower in the stack

Two `verifyProof` calls per settlement, ~270k gas each, so **~540k gas plus the transfer**. As an application contract, that is the honest number, and it does not reach "millions of transactions per second" or "a cent or less per call".

That gap is the argument, not an omission. Three ways to close it, in increasing order of how much chain you need to own:

| Approach | Cost per settlement | Needs |
|---|---|---|
| Two verifies in an app contract (**this repo**) | ~540k gas | nothing — works today on Base Sepolia |
| Recursive aggregation: both institutions' receipts folded into one proof | ~270k gas, one verify | a proving pipeline; the guest is unchanged |
| Native verifier precompile + policy receipts in the protocol | amortised toward a signature check | your own chain |

The third row is the interesting one, and it is only available to someone building the settlement layer itself. A policy primitive that has to pay 540k gas to an application contract will not carry institutional volume; the same primitive verified natively is roughly a signature check. **That is the case for putting programmable private policy in the chain rather than above it** — and it is the reason this demo stops where it stops.

---

## Operating the clip

The live page drives a real desk. State lives on chain, so the clip is shared: whoever clicks advances it for everyone.

- **Phase is derived from contract state** (`usedTransfer`, `policyHashOf`), not from a sliding event window, so a settled desk cannot read back as fresh.
- **Set `SIETCH_FROM_BLOCK`** to the desk's deploy block. Without it the event scan falls back to the deploy block recorded in `artifacts/demo/chain.json`.
- **A spent desk stays spent.** There is no recorded replay. Re-arm to walk it again.
- **Re-arm** with `bun run rearm`: deploys a fresh `Desk` against the existing `sTBILL`, mints the share, rewrites `chain.json`, and prints the `vercel env` commands to run. The receipts bind vkey, orgs, token id, policy seals and transfer ids — **not** the desk address — so a new desk restores the clip without reproving.

## Reproducing the proofs

`cargo prove` needs the SP1 toolchain (`sp1up`). Local Groth16 wants Docker with ≥16GB. The path this repo used, and the one to prefer:

```sh
# Succinct prover network — set NETWORK_PRIVATE_KEY yourself, funded with PROVE
modal run apps/modal/prove.py           # see apps/modal/README.md
cargo run --release -p sietch-prove --bin prove-one -- chani-outbound   # execute-only, no proof
```

`cargo run … --bin prove-one` with no network key writes `*.execute.json` (cycle count, public values, `proof: null`) — enough to check the guest without a proving box. One execute is ~25.5k cycles: this is a policy check, not a workload.

---

## Layout

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router (`src/app` routes, `src/features/*` domains, `src/shared`) |
| `crates/policy` | Policy evaluation + seals. One institution per call |
| `crates/policy-guest` | Guest I/O. Fixed-length stdin, one policy |
| `crates/policy-program` | SP1 zkVM shell around the guest |
| `crates/prove` | Execute / Groth16 / write artifacts, isolated stdin |
| `contracts` | Foundry: `TBill.sol`, `Desk.sol` (two receipts + publish) |
| `artifacts/demo` | Committed receipts, public values, and the deployment record |
| `apps/modal` | One-shot Modal prove box |
| `packages/ui` | shadcn/ui (`@repo/ui`) — never install components into `apps/web` |
| `packages/db` | Drizzle ORM + Neon (`@repo/db`) |
| `tooling/*` | Shared tsconfigs, MSW handlers, feature-folder import rules |
| `e2e/web` | Playwright for `web` |
| `docs/plans` | Design and threat model — read `2026-08-15-sietch-design.md` first |

Features must not import each other. Compose in `app/`, or hoist to `shared/` / `packages/`. `bun run check-boundaries` enforces that.

**Requires** [Bun](https://bun.sh) `1.4.x`. Installs with anything else will fail (`only-allow bun`).

## Commands

```sh
bun install
bun run dev              # all apps
bun run build
bun run check-types
bun run check-boundaries
bun test
bun run rearm            # fresh desk, re-armed clip
bunx playwright install chromium   # once
bun run e2e
```

```sh
export PATH="$HOME/.sp1/bin:$HOME/.foundry/bin:$PATH"
cargo test --workspace
forge test --root contracts
```

---

## Related

**[bare-metal](https://github.com/hivinaynair/metal)** — the companion project, and a different pillar. Bare Metal is compliance enforced **before funds move**: ERC-8004 identity, AP2 mandates, and x402 settlement, with an agent at the center. Sietch is compliance enforced **without disclosure**. Deliberately two projects: the agentic pillar and the institutional-privacy pillar do not share a threat model, and collapsing them into one demo would have muddled both.
