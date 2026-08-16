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

The same four stubs as the live page.

### The v1 seal is enumerable

Unsalted hash; under 200 guesses recover the clauses. `policy_commitment` in `crates/policy`; wiring it changes the vkey.

### The receipts name a demo token id

Both receipts commit `0x3333…`; the proof is not bound to the asset that moves. Deploy the token first, then prove against its address.

### One operator key stands in for two institutions

One clerk signs both calls; two receipts, one machine. Stdin is 146 bytes; a decode error if two policies are concatenated.

### Proving is precomputed, verification is live

Four receipts were generated ahead of time; this page does not prove. Instant means two `verifyProof` calls, roughly 540k gas.

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
- **Re-arm** deploys a **new** `TBill` and `Desk`, mints 1 share onto the desk, and stores the pointer on `ClipFactory`. Receipts bind vkey, orgs, token id, policy seals and transfer ids — **not** the desk address — so a new desk restores the clip without reproving. A new token is required because reusing the previous sTBILL would leave shares on Paul’s institution, so idle books would already show Paul holding.
  - **On the live page:** **Re-arm** (next to Refresh) confirms “this spends gas and starts a new desk,” then `POST /api/clip/rearm` calls `factory.rearm()`. The room refetches; books should read 1 on the desk and 0 on Paul. Refresh only re-reads chain — it does not rotate a spent desk.
  - **From this machine:** `bun run rearm` deploys the factory once, then later calls `rearm()` on it. Set `SIETCH_FACTORY_ADDRESS` on the web app (and Vercel) **once**. After that, website re-arm needs no env bump and no redeploy. **Do not walk the desk** until the Loong demo.

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
| `contracts` | Foundry: `TBill.sol`, `Desk.sol`, `ClipFactory.sol` (pointer + re-arm) |
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
