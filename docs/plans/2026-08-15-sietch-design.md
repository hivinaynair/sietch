# Sietch design

Date: 2026-08-15  
Audience: a React/Next engineer (and future us) who has not lived in ZK.  
Status: architecture locked for v1 unless a fact below is wrong.

This is the product design, not a line-by-line implementation plan. Implementation comes after you say this document is right.

## 1. What we are building, in one paragraph

Sietch is a **job-application demo for Metal (Loong)**. It is not a blockchain. It is not Bare Metal and not Touchstone.

Metal’s unsolved sentence ([Hello, Metal](https://metalntwx.com/blog/hello-metal/)): when funds do not settle instantly, it is often the **AML / fraud policies of the beneficiary’s institution** — and an ideal chain lets **institutions and regulators** define custom rules, **enforce them on-chain as part of settlement**, without the **network seeing the policy**. Homepage: compliance executes **provably, privately, and instantly** during settlement.

Sietch demonstrates **one** Metal primitive: **programmable private policy at settlement**. Not customer identity, not agents, not Airwallex ramps. Those are his other pillars; we name them out of scope so it does not look like we missed them by accident.

**Four actors.** Two people, two **institutions**. Only the institutions own policy. A T-bill may sit with a custodian, broker, or treasury; we use **institution** as the type. Paul’s side is the **beneficiary institution**. A regulator would be a third policy publisher; v1 does **not** add that seat.

**Institution book is assigned, not self-declared.** A **directory** (in production: a charter / license record; in this demo: two rows written at deploy) binds each org address to a jurisdiction **label** (India / US). Institutions publish corridor rules (`accepts_cross_border`, `max_amount`). They cannot write or overwrite their own book. That is not a passport and not real FEMA/OFAC. Customer identity stays **v2**.

| Actor | Who | Does |
|---|---|---|
| **Chani** | Customer of the sending institution (labelled India) | Instructs a T-bill delivery. Never publishes policy. |
| **Chani’s institution** | Sending institution (outbound T-bill policy, private) | Must allow the send. Issues its **own** receipt. |
| **Paul** | Customer of the beneficiary institution (labelled US) | Is the beneficiary principal. Never publishes policy. |
| **Paul’s institution** | Beneficiary institution (inbound T-bill policy, private) | Must allow the receive. Issues its **own** receipt. **Only this institution publishes v2.** Loong sits here. |

**Two receipts, not one shared prover.** Loong’s attack on subnets is that **operators can see everything**. One guest that reads **both** rulebooks recreates that hole. v1: the **same** program runs **twice**. Each run’s private input is **only that institution’s** inbound or outbound T-bill policy. The contract verifies both receipts in **one settlement transaction** and moves the share iff both `allowed`. The demo operator may generate both proofs on one machine, but **never in one stdin**. README says: production Metal would have each institution prove locally; this recording isolates stdin the same way.

The public site shows: Chani’s institution allowed, Paul’s institution refused → Paul’s institution publishes **inbound T-bill policy v2** → Chani instructs the **same** delivery again → both allow, share **settles for Paul**.

**Name.** Sietch = Fremen settlement. Water stays inside; outsiders see the rock. The network does not see the channel.

## 2. Words you need (React analogies)

| Term | Meaning | Like |
|---|---|---|
| **Smart contract** | Code that runs on a shared computer (Base Sepolia). Everyone can replay it. Secrets cannot live there. | A public API with no private env vars |
| **Base Sepolia** | A test copy of Ethereum (Coinbase’s L2 testnet). Fake money. | Staging, not production |
| **ERC-20** | The usual token interface: `transfer`, `balanceOf`. Our “T-bill” is this, with an honest name. | A row in a balances table |
| **Guest / program** | The tiny Rust function we prove. One ELF, run once per institution. | `evaluateQuorum`, but it cannot see the internet |
| **Receipt** | One Groth16 proof that **this** institution’s private policy allowed or denied **this** transfer. | A signed webhook from one vendor, not a combined payload |
| **zkVM (SP1)** | A machine that proves “this program ran and these public outputs came out.” Stand-in for Metal’s chain-native verifier. | A CI run that produces a signed artifact of the logs |
| **Private input (stdin)** | Data **that** prover knows; the chain does not. **Only one** institution’s clauses per run. | Request body that never hits the response |
| **Public values** | Outputs committed by the guest. The chain *does* see these. | JSON the client is allowed to cache |
| **Proof (Groth16)** | ~260-byte receipt that the guest ran. | A JWT, but for a function call |
| **Verification key (vkey)** | Fingerprint of the guest ELF. The contract only accepts proofs for *this* program. | The issuer of the JWT |
| **Gateway** | Succinct’s `SP1VerifierGateway` already on Base Sepolia. We call it; we do not write a Groth16 verifier. | Stripe’s API, not our card processor |
| **Instant (honest)** | Once both receipts exist, settlement is **one on-chain check** (two `verifyProof` calls, then transfer or emit). Not “the browser proved this in milliseconds.” | Webhook signature check, not generating the signature in the UI |

**Zero-knowledge** here means: the chain learns the **public values** and that they came from the guest. It does **not** learn stdin (the clauses). It is not “the whole transfer is invisible.” Amounts and parties can stay public in v1. That is an honest limit (activity privacy is the subnet paragraph; we are answering the **policy** paragraph).

## 3. What Loong should believe after three minutes

1. Chani can instruct a delivery that her **own** institution allows and Paul’s **beneficiary** institution still refuses.
2. The chain cannot print either institution’s inbound/outbound T-bill rules, including on deny. It may show **which institution** failed.
3. **Paul’s institution** (not Paul) publishes inbound T-bill policy v2. Chani instructs the **same** delivery again. It **settles for Paul**.
4. Each institution’s rulebook stayed in **that** pocket. Settlement is the AND of two receipts — not a shared operator who saw both policies, and not an analyst clicking Allow on a ticket.
5. A model never decided this. SP1 is a stand-in. We do not pitch “we used Succinct.” Verification is instant; proving is precomputed.

## 4. Threat model (this is the product)

**Attacker:** anyone reading Base Sepolia (calldata, events, our UI). Also: a prover process. A prover must not be given the **other** institution’s policy bytes.

**Must not learn (network):** either institution’s clauses (the inbound T-bill size stub, later denylist). Especially not via “denied because amount-tier max 100.”

**Must not learn (prover):** the **other** institution’s policy. Stdin is one policy per execute.

**May learn (v1, stated in the README):** Chani, Paul, both institutions, amount, token, **two policy hashes**, which side failed (`sender` / `receiver` / none), verdict, tx hashes. Jurisdiction labels (India / US), not real law.

**Must not happen:**

- Token moves without **two** valid proofs for this vkey, matching sides, same `transferId` / token / amount.
- Replaying an old success pair to move the token twice (`transferId` consumed once).
- Using a sender receipt as a receiver receipt (`side` is bound in public values).
- A deny that includes a reason enum the observer can map to a size stub.
- UI copy that prints the stub, says “cap,” “payment,” or “correspondent.”
- One stdin that concatenates both policies.

**How deny works without leaking.** Two receipts in one tx. Public: `senderAllowed`, `receiverAllowed` (decoded from each receipt). Contract transfers only if both are true. A tx with sender true / receiver false is the Metal sentence. No reason field. Copy: **settlement pending beneficiary policy** — not “held at correspondent.”

**Policy publish.** Each institution has `bytes32 policyHash` on-chain. **Only the beneficiary institution publishes in the demo** (inbound T-bill policy v1 → v2). Chani’s institution keeps one version so her outbound stays allowed. Chani and Paul have no publish key. Publish is a **new rule version**, not clearing one ticket.

## 5. The clip

Idle: Chani (India customer) has instructed her institution to deliver 1 T-bill share to Paul at his US institution. You are **Paul’s institution** (the beneficiary).

1. **Instruct / settle attempt.** Two receipts. Chani’s institution: allowed. Paul’s institution: denied. Token stays. UI names the **beneficiary institution**, not a size stub.
2. **Publish.** Paul’s institution (not Paul) sets inbound T-bill policy v2. Chani’s institution unchanged.
3. **Instruct again.** Same Chani, same Paul, same amount. Two new receipts (new `transferId`). Both allowed. Share **settles for Paul** (posts to the beneficiary institution for him).

Chani and Paul never click Publish. Nobody clicks Allow on a flagged transfer.

Evidence is the two settlement txs (each with two receipts) and the publish tx, not a gate animation.

## 5b. UI and journeys

**One URL, four seats, not four products.** A production institution would give Chani a client app and its treasury a console. Sietch v1 is a job-application clip. Four logins would be a suite, not a 3-minute proof.

The page is a settlement room on Touchstone paper. A seat switcher (Chani · Chani’s institution · Paul · Paul’s institution) changes copy and which actions exist. **Default seat: Paul’s institution** (Loong). Chain state is shared; switching seats does not create a second world.

### Screen

1. **Header** — Sietch. “You are Paul’s institution.” Seat switcher.
2. **Stage** — one sentence: 1 T-bill share, India → US. Names and amount visible (v1 amounts are public).
3. **Four seats** — 2×2. People on top, institutions below. Active seat: lilac edge (`#e7c5ff`). Paul’s institution is visually primary even when you peek at Chani.
4. **Actions** — Chani seat: **Instruct my institution** (starts send 1 / send 2). Paul’s institution after deny: **Publish inbound v2**. No other seat can publish.
5. **Evidence** — collapsed hashes, `senderAllowed` / `receiverAllowed`, Basescan. Never the stub number. Never “cap.”

### Journeys (same clip, four voices)

| Seat | Goal | Clicks | After send 1 | After publish + send 2 |
|---|---|---|---|---|
| Chani | Get 1 share to Paul | Instruct | My institution allowed; his institution blocked | Settled for Paul |
| Chani’s institution | Outbound T-bill that is legal for us | None in the clip | Outbound allowed; settlement pending beneficiary policy | Settled for Paul |
| Paul | Receive | None that change policy | Incoming blocked by my institution | Received |
| Paul’s institution | Enforce inbound T-bill policy | Publish v2 | We refused (hash only) | Allowed; settled on our books for Paul |

Chani instructing is the *intent*. Each institution still produces a receipt. The UI must never look like Chani published a rule.

## 6. What we use, and why (researched)

Decisions below cite first-party docs. If a doc changes, we revisit.

### 6.1 SP1 zkVM (Succinct), guest in Rust — yes

[What is a zkVM](https://docs.succinct.xyz/docs/sp1/what-is-a-zkvm): prove `f(x)=y` without putting `x` on-chain. Guest is RISC-V from Rust. [Introduction](https://docs.succinct.xyz/docs/sp1/introduction): no custom circuits.

Metal’s sentence is **programmable** private policy. A zkVM is a program. Noir is a circuit DSL ([Noir docs](https://noir-lang.org/docs)) aimed at Aztec-style private execution. We already compared these; SP1 is the stand-in. NoirJS proving in the browser does not matter: the public page uses **precomputed** proofs.

Scaffold with `cargo prove new --evm` ([quickstart](https://docs.succinct.xyz/docs/sp1/getting-started/quickstart)): `program/` (guest), `script/` (prove), `contracts/` (Foundry). We nest that under `crates/` + `contracts/` in this Bun monorepo.

Pin **sp1-zkvm 6.1.0** (current docs setup example) unless install-time docs say otherwise.

**Same ELF, two executes per settlement.** Do not fork two guests. Bind `side` (sender vs receiver) in public values so receipts cannot be swapped.

### 6.2 Groth16 wrap for Ethereum — yes, with a caveat

Native SP1 proofs are STARKs: too big/expensive to verify on Ethereum ([on-chain verification](https://docs.succinct.xyz/docs/sp1/verification/getting-started)). They wrap to Groth16 or PLONK.

[Proof types](https://docs.succinct.xyz/docs/sp1/generating-proofs/proof-types):

- **Groth16** (recommended): ~260 bytes, ~270k gas **per verify**. Trusted setup = Aztec Ignition + Succinct entropy. We **disclose** that in the README.
- **PLONK**: no extra trusted setup, ~868 bytes, ~300k gas, slower, **64GB+ RAM** locally.

v1 = Groth16. Two verifies per settlement ≈ **~540k gas** plus transfer. If Loong hates trusted setups, we can regenerate PLONK proofs later; the guest does not change.

Local Groth16: Docker, **16GB+ RAM**, Docker Desktop memory bump on Mac ([hardware](https://docs.succinct.xyz/docs/sp1/getting-started/hardware-requirements)). Aggregation wants 32GB. We develop with `--execute` (no proof) and `SP1_PROVER=mock` until the guest is right, then Groth16 **four** times for the public page (send 1 sender, send 1 receiver, send 2 sender, send 2 receiver).

Succinct Prover Network is optional later. v1 must be reproducible on your machine so we are not a cloud-API demo.

**Instant** = those verifies inside `settle`. Not live proving in the tab.

### 6.3 Call the canonical gateway on Base Sepolia — yes

Do not deploy our own Groth16 verifier. [Contract addresses](https://docs.succinct.xyz/docs/sp1/verification/contract-addresses) + [deployments/84532.json](https://github.com/succinctlabs/sp1-contracts/blob/main/contracts/deployments/84532.json):

- Groth16 gateway Base Sepolia (84532): `0x397A5f7f3dBd538f23DE225B51f532c34448dA9B`

Our contract: two calls `ISP1Verifier(gateway).verifyProof(vkey, publicValues, proofBytes)` then business logic. Pattern from [sp1-contracts README](https://github.com/succinctlabs/sp1-contracts). Solidity **0.8.20** as they require.

Replay: the gateway is `view`. **We** must consume a `transferId` shared by both publics (Succinct TEE verifier docs even warn that replay is the app’s job).

### 6.4 Toy ERC-20 T-bill — yes

Not BlackRock BUIDL. Not ERC-3643 (permissioned security token — a real RWA standard, too much surface for v1). Name in the token and README: `Sietch T-Bill Share (demo)`.

This is a **T-bill delivery**, not a payment. Loong-facing copy: **inbound T-bill policy** / **outbound T-bill policy**. Origin is a **book label from the directory**, not a country the customer types and not a field the institution publishes. Outbound receipts may only attest `origin == directory[org]`. The live flip is Paul’s `accepts_cross_border`: v1 false → v2 true. `max_amount` stays 10. We do not verify customer passports (that identity is v2). Do not print the flag on the public page.

### 6.5 Foundry for contracts — yes

Required by `cargo prove new --evm`. We already used Foundry-shaped workflows in Metal/Touchstone. App talks to the chain with **viem** (TypeScript), not from the guest.

### 6.6 Next.js settlement room in `apps/web` — yes

You own this. Touchstone Whisper Flow tokens (below). Light only.

**Strip Clerk for v1.** The public clip is not a SaaS login. Clerk is in the vipernxt boilerplate; it adds env and a “product” that is not the claim. The beneficiary institution does not “log in as Paul.” Publish in the recorded demo is a pre-sent tx or a demo operator key, never a visitor wallet rewriting live policy.

### 6.7 Precomputed proofs on the public URL — yes

SP1 Groth16 is not a browser SDK. NoirJS is; we still are not using Noir. Delivery: four proof blobs + settlement/publish tx hashes in the repo or a public JSON the page reads. `bun`/`cargo` `prove` documented for reproduction.

## 7. What we will not use (and why)

| Rejected | Why |
|---|---|
| New L1 | Metal’s job, not an application |
| One guest stdin with **both** policies | Recreates “operators can see everything” |
| Noir / Aztec.nr | Wrong ecosystem signal; circuit not “programmable policy as a program” |
| Fake proofs in React state | He will know |
| Live “click and wait for Groth16” on the homepage | Fragile; not instant settlement; looks broken |
| Claiming “instant proving” | Instant = verify at settlement |
| x402 / Eve / agent spline | Bare Metal / Touchstone; different Metal pillar |
| Shielded amounts / Aztec-style tx privacy | Second research problem; v1 is **policy** privacy |
| Recursion / proof aggregation | [SP1 aggregation](https://docs.succinct.xyz/docs/sp1/writing-programs/proof-aggregation) is for huge jobs. Two receipts do not need it |
| ERC-3643, real T-bills, Airwallex | Honesty: demo asset, no ramps |
| Models in `verifyProof` | Destroys the invariant |
| Printing `DenialReason.limit` or “cap is X” | Oracle for the stub |
| “Correspondent” / “payment” / “clear this transfer” | Old rails, or the delay he is attacking |
| Fifth “regulator” seat | His sentence includes regulators; the clip cannot. The **directory** is two deploy-time rows, not a live regulator console |
| Customer identity / ERC-8004 / 8183 / on-chain KYC whitelist | **v2, not v1.** Institution **book** is v1 (directory). 8004 is agent identity (Bare Metal). A public customer whitelist leaks the eligible set. If we add customer identity later: private “this principal is a customer of this institution” **inside the same receipt**, still not 8004. |
| Editing live Touchstone `vendor-trust` | Different repo |

## 8. Guest I/O (the actual function)

One program. **Two runs** per settlement. Private stdin is **one** policy.

Private (stdin), one institution:

```text
policy bytes  // { max_amount, accepts_cross_border }  — no home; book is directory[org]
```

Public (commit, `abi.encode` order matching Solidity):

```text
bytes32 policyHash;
address org;
address token;
uint256 amount;
bytes32 transferId;
uint8 side;      // 0 = sender (outbound), 1 = receiver (inbound)
bool allowed;
```

Guest (each run):

1. Read this institution’s private policy and the public transfer fields.
2. `policyHash` matches keccak of those policy bytes.
3. Look up `home = directory[org]`. Unknown org → deny. Outbound: `origin == home`. Inbound: same book **or** `accepts_cross_border`. Amount still in range.
4. Commit the public struct. Do not read the other institution’s bytes.

Contract `settle(senderProof, senderPublic, receiverProof, receiverPublic)` after two `verifyProof`:

1. Both proofs valid for this vkey.
2. `senderPublic.side == 0`, `receiverPublic.side == 1`.
3. Same `transferId`, `token`, `amount`.
4. `senderPublic.org` / `receiverPublic.org` are the stored sending / beneficiary institutions, and each org’s book matches the directory row written at deploy (institutions cannot rewrite it).
5. Hashes match the two stored institution hashes.
6. `token == ourTbill`.
7. `transferId` unused → mark used.
8. If both `allowed`, move the token to the beneficiary institution (for Paul). Else emit only (`senderAllowed` / `receiverAllowed` from the two publics).

**Execute without proving** during development (`cargo run -- --execute`). Tests: sender-only stdin allowed; receiver-only stdin denied then allowed after v2 bytes. Cycle count should stay tiny (thousands, not billions). **Fail the suite if a test helper ever concatenates both policies into one stdin.**

## 9. Repo shape (this monorepo)

```
sietch/
  apps/web/              Next.js settlement room (Bun, existing vipernxt layout)
  packages/ui/           shadcn + Touchstone tokens
  packages/db/           optional later; v1 can be static proof artifacts
  crates/policy-guest/   SP1 program (Rust) — one ELF, two executes
  crates/prove/          SP1 script: execute / groth16 / write artifacts (isolated stdin)
  apps/modal/            One-shot Modal prove box (user hi-83670, app sietch-prove, not thumper-worker)
  contracts/             Foundry: TBill.sol, Desk.sol (settle two receipts + publish)
  artifacts/demo/        committed publicValues + proof bytes + tx hashes for the URL
  docs/plans/            this file
  docs/research/         noir-vs-sp1.md
```

Do not put the guest inside `apps/web`. Do not import Rust from Next. The web app reads **artifacts** (JSON) and displays Basescan links. Operator scripts deploy and prove.

Keep `@repo/*` workspace names for now (vipernxt). Renaming the scope is cosmetic.

## 10. Visual language

Copy Touchstone (`packages/ui/src/styles/globals.css` there), Whisper Flow light:

- Paper `#f5f4f0`, ink `#1a1a1a`, card `#ffffff`
- Primary/accent `#e7c5ff` + dark text
- Border `#ded9cf`, success `#075c4e`, warning `#8a5a11`, deny `#a33b45`
- Radius `0.875rem`
- Fonts: Geist, Newsreader headings, IBM Plex Mono
- Light only. White surfaces on paper. No shadow chrome.
- **Same scheme, different layout** — institutions and a verdict, not Touchstone’s floor.

Public copy: **instruct**, **deliver**, **inbound T-bill policy**, **settlement pending beneficiary policy**, **settled for Paul**. Not pay, cap, correspondent, or Allow this transfer.

## 11. Risks we accept

- Your Mac needs Docker memory ≥16GB for **four** Groth16 proofs. If it OOMs, we use Succinct’s network once and still commit the artifacts.
- Two verifies per settle (~540k gas) — disclosed.
- Groth16 trusted setup (disclosed).
- Amounts are public (disclosed). A determined observer can still binary-search the inbound stub if we let them submit arbitrary amounts. The **public demo** only exposes the two scripted deliveries, not a free prover. README says that.
- Demo operator generates both receipts on one laptop. Isolation is **stdin discipline**, not two companies. README says production = each institution proves locally.
- SP1 version skew vs gateway routes: pin crate version to a gateway-supported release ([versioning policy](https://docs.succinct.xyz/docs/sp1/verification/contract-addresses)).

## 12. Build order (after this doc is approved)

1. Tokens + light theme in `packages/ui` (no product UI yet).
2. Guest + **execute** tests with **isolated** stdin (sender allow; receiver deny; receiver v2 allow). No Groth16 yet. Guard: no dual-policy stdin.
3. Foundry contracts + tests with a **mock verifier**: two proofs required, side-swap rejected, replay rejected, deny emits without transfer.
4. Wire real gateway on Sepolia; Groth16 for one side first, then the pair.
5. Settlement room UI reading artifacts (copy from §10).
6. Four proofs + publish tx; freeze demo artifacts.
7. README for Loong (claim first, two receipts, stand-in, what’s not real, instant = verify).

Eve stays later: agents draft policy; they do not settle.

**v2 (not this clip):** principal membership inside the private receipt. Not ERC-8004. Not a public allowlist.
