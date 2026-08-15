# How the policy crate works

Date: 2026-08-15  
Audience: you, coming back later. React / Next analogies on purpose.

This is a line-by-line reading of `crates/policy`. It is not the product design (that is `docs/plans/2026-08-15-sietch-design.md`). Open the source beside this note.

---

## What is a crate?

A **crate** is a Rust package. Same idea as one folder in the Turborepo with its own `package.json`.

```text
sietch/                          ← workspace (like the monorepo root)
  Cargo.toml                    ← lists members (like turbo.json + workspaces)
  crates/policy/                ← one crate
    Cargo.toml                  ← this package’s name + deps
    src/
      lib.rs                    ← the library (exportable functions)
      main.rs                   ← a CLI that *uses* that library
```

`apps/web` is a Next app. `crates/policy` is a Rust library. It lives under `crates/` instead of `apps/` because it is not a website.

Later the SP1 guest will **import this same library**. That is why the real logic lives in `lib.rs`, not in the CLI.

---

## The two `Cargo.toml` files

### Root: `/Cargo.toml`

Workspace file. Like `"workspaces": ["apps/*", "packages/*"]`.

```toml
[workspace]
resolver = "2"
members = ["crates/policy"]
```

| Field | Meaning |
|---|---|
| `members` | These folders are packages |
| `resolver = "2"` | Cargo’s dependency algorithm version. You almost never think about it |

### Crate: `crates/policy/Cargo.toml`

This package’s `package.json`.

| Field | Meaning | JS equivalent |
|---|---|---|
| `name = "sietch-policy"` | Name on the command line (`cargo test -p sietch-policy`) | `"name"` in package.json |
| `version` / `edition` / `license` | Metadata. `edition = "2021"` is the Rust language edition (a dialect, not a year you must match) | engines / license |
| `[dependencies]` | Runtime deps | `dependencies` |
| `hex` | Turn bytes into `0xabc…` for printing | a tiny util |
| `tiny-keccak` | Keccak-256, same family Ethereum uses for `keccak256` | viem’s `keccak256` |
| `[dev-dependencies]` | Only for tests | `devDependencies` |
| `pretty_assertions` | Nicer `assert_eq` diffs | jest’s pretty diffs |
| `rstest` | Table-driven tests (`#[case]`) | `it.each` |
| `[lib] name = "sietch_policy"` | How **other Rust code** imports it: `use sietch_policy::…` | the package export name. Hyphens become underscores because Rust identifiers cannot have `-` |

`cargo test` / `cargo run` read these files the way `bun test` reads `package.json`.

---

## `lib.rs` vs `main.rs`

Rust’s convention, baked into Cargo:

| File | What it is | When it runs |
|---|---|---|
| `src/lib.rs` | A **library**. Types + functions other crates can `use`. | `cargo test`. Later: the SP1 guest. |
| `src/main.rs` | A **binary**. Must have `fn main()`. | `cargo run -p sietch-policy -- …` |

This crate has **both**. That is allowed and common.

- `lib.rs` = `packages/policy/src/index.ts` — the real product.
- `main.rs` = a tiny `scripts/play-policy.ts` so you can poke it from the terminal.

`main.rs` does **not** reimplement the rules. It parses argv, calls `evaluate`, prints. If we put the rules only in `main.rs`, the guest could not import them.

**Why this matters for Loong:** the receipt will prove “this function ran.” That function is `evaluate` in `lib.rs`. The CLI is just a flashlight.

---

## `lib.rs` line by line

File: `crates/policy/src/lib.rs`

### Header and import

```rust
//! Private T-bill policy for **one** institution.
//!
//! **Book** (India / US) is not a field the institution writes. It comes from a
//! **directory** — in production a charter / license record; in this demo two
//! rows we deploy. Institutions publish corridor rules. They do not self-KYC.
//! Customers still do not prove identity. That is v2.

use tiny_keccak::{Hasher, Keccak};
```

`//!` is a **crate-level** doc comment (the README of this file). `///` later is docs on the next item.

`use tiny_keccak::{Hasher, Keccak}` is `import { Hasher, Keccak } from 'tiny-keccak'`.

### `Book` and `Side` — enums

```rust
/// Jurisdiction **label** on an institution's book. Not a passport, not FEMA.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Book {
    India,
    Us,
}

/// Which receipt this run is: sending institution or beneficiary institution.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Side {
    Outbound,
    Inbound,
}
```

`enum` = a TypeScript union that the compiler enforces: `type Book = 'India' | 'Us'`. You cannot invent `'France'`.

`pub` = exported. Without `pub`, `main.rs` could not name `Book`.

`#[derive(…)]` asks the compiler to generate trait impls (like auto-deriving):

| Trait | Meaning |
|---|---|
| `Clone` | `.clone()` — copy the value |
| `Copy` | so small it copies on assign (no `.clone()` needed). Like copying a number |
| `Debug` | `{home:?}` in `println!` |
| `Eq` / `PartialEq` | `==` and `assert_eq!` |

### `OrgId` — a newtype

```rust
/// On-chain-shaped institution id. Twenty bytes, like an address.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct OrgId(pub [u8; 20]);

/// Demo orgs. Later these are the two institution addresses on the desk.
pub const CHANI_INSTITUTION: OrgId = OrgId([0x11; 20]);
pub const PAUL_INSTITUTION: OrgId = OrgId([0x22; 20]);
```

`struct OrgId(pub [u8; 20])` is a **tuple struct**: a named wrapper around 20 bytes. Ethereum addresses are 20 bytes. We are not on-chain yet; the shape is so we do not later swap this for a `string`.

`[0x11; 20]` = an array of twenty `0x11` bytes. Chani’s fake address is `0x1111…11`. Paul’s is `0x2222…22`. `Hash` is so it can be a map key later.

`const` = compile-time constant. Like `export const CHANI_INSTITUTION = …`.

### `Directory` — the charter rows

```rust
/// Assigned books. An institution cannot insert or overwrite a row.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Directory {
    rows: [(OrgId, Book); 2],
}

impl Directory {
    pub fn demo() -> Self {
        Self {
            rows: [
                (CHANI_INSTITUTION, Book::India),
                (PAUL_INSTITUTION, Book::Us),
            ],
        }
    }

    pub fn home_of(&self, org: OrgId) -> Option<Book> {
        self.rows
            .iter()
            .find(|(id, _)| *id == org)
            .map(|(_, book)| *book)
    }
}
```

`struct` with a **named field**. `rows` is **not** `pub`. Outside this file you cannot do `directory.rows[0] = …`. That is the pitch: institutions cannot rewrite the table.

`[(OrgId, Book); 2]` = a fixed array of two `(org, book)` pairs. Not a `Vec` (growable list). Two institutions, two rows.

`impl Directory { … }` = methods on the type. Like `class Directory { demo() {…} homeOf() {…} }`.

- `demo() -> Self` — constructor. `Self` = `Directory`.
- `home_of(&self, org)` — `&self` means “borrow, do not take ownership.” Like a method that reads `this` without moving it.
- `Option<Book>` = `Book | null`, but honest: `Some(India)` or `None`. Unknown org is `None`, and `evaluate` turns that into deny.

`.iter().find(…).map(…)` is array `.find` then take the book. `*_` ignores the other half of the pair. `*id` / `*book` dereference because `iter()` yields references.

### `Policy` and `Delivery`

```rust
/// Corridor rules this institution publishes. No `home` — that is the directory.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Policy {
    pub max_amount: u64,
    /// Inbound only: accept a delivery whose origin label is not this org's book.
    pub accepts_cross_border: bool,
}

/// Facts this institution is willing to bind into its receipt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Delivery {
    pub amount: u64,
    pub origin: Book,
}
```

`Policy` = what they **publish** (corridor). `Delivery` = this one instruction (how many shares, which book they claim the share came from).

`u64` = unsigned 64-bit integer (0 to a huge number). `bool` is `true` / `false`.

Fields are `pub` so tests and `main` can write `Policy { max_amount: 10, … }`. `home` is intentionally **not here**.

### Hashing — why bytes exist

```rust
pub fn policy_bytes(policy: &Policy) -> [u8; 64] {
    let mut out = [0u8; 64];
    out[24..32].copy_from_slice(&policy.max_amount.to_be_bytes());
    if policy.accepts_cross_border {
        out[63] = 1;
    }
    out
}

pub fn policy_hash(policy: &Policy) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    hasher.update(&policy_bytes(policy));
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}
```

**What we are doing:** turn the policy into a 32-byte fingerprint. The chain will store that fingerprint. It will not store the clauses.

**React analogy:** you store `sha256(JSON.stringify(settings))` in a public table. The UI never prints the settings. If Paul flips `accepts_cross_border`, the hash changes — that is “publishing v2.”

Why 64 zero bytes, then poke two slots?

Solidity’s `abi.encode` of two `uint256`s is 64 bytes (32 + 32). We are matching that layout **now** so later the contract can `keccak256` the same bytes and get the same hash.

- Bytes `24..32` of the first word = the 8 bytes of `max_amount` (big-endian). The first 24 bytes stay `0` because `u64` is smaller than `uint256`.
- Last byte of the second word = `1` if the corridor is open.

`&Policy` = borrow. The function reads the policy; it does not take it away.

`to_be_bytes()` = big-endian (same as Ethereum).

Keccak-256 always outputs 32 bytes. That is `bytes32` on chain.

### `evaluate` — the only business rule

```rust
/// `org` must already be in `directory`. Home is looked up, never taken from `policy`.
pub fn evaluate(
    policy: &Policy,
    delivery: &Delivery,
    side: Side,
    directory: &Directory,
    org: OrgId,
) -> bool {
    let Some(home) = directory.home_of(org) else {
        return false;
    };
    if delivery.amount > policy.max_amount {
        return false;
    }
    match side {
        Side::Outbound => delivery.origin == home,
        Side::Inbound => delivery.origin == home || policy.accepts_cross_border,
    }
}
```

This is the function the guest will prove.

1. Look up this org’s book. Not in the directory → `false` (stranger cannot settle).
2. Amount over the stub max → `false`.
3. **Outbound** (Chani’s institution): you may only attest your **assigned** book. India institution cannot say “this share is US.”
4. **Inbound** (Paul’s institution): same book **or** the corridor flag. v1 flag is false → India origin denied. v2 flag is true → allowed.

`let Some(home) = … else { return false }` is Rust for “if lookup failed, deny; otherwise `home` is the book.”

`match` is a switch that must cover every `Side`. Forget a variant and it will not compile.

`-> bool` = returns `true` / `false`. Last expression in a block is the return (no `return` keyword needed).

### Tests — bottom of the same file

```rust
#[cfg(test)]
mod tests {
    use super::{
        evaluate, policy_hash, Book, Delivery, Directory, OrgId, Policy, Side,
        CHANI_INSTITUTION, PAUL_INSTITUTION,
    };
    use pretty_assertions::{assert_eq, assert_ne};
    use rstest::rstest;
```

`#[cfg(test)]` = only compile this module when testing. Like a file that Vite never bundles into production.

`mod tests` = a nested module (a folder-in-a-file).

`use super::…` = import from the parent (`lib.rs` itself). `super` = `../`.

`rstest` + `#[case::name(…)]` is `it.each`. One function, five clip rows:

| Case | Meaning |
|---|---|
| Chani outbound, origin India | allow |
| Chani outbound, origin US | deny (cannot fake origin) |
| Paul inbound v1, origin India | deny (corridor closed) |
| Paul inbound v2, origin India | allow (corridor open) |
| Paul inbound v1, origin US | allow (domestic) |

Then two extra tests:

- **Unknown org** (`0x99…`) → deny even if they open every flag.
- **Paul outbound with India origin** → deny. He cannot “become” the India book by picking a flag.
- **Hash changes** when the corridor flag flips. That is the on-chain “v1 vs v2” signal.

`assert!(!evaluate(…))` means “this must be `false`.” `!` is not.

```bash
source "$HOME/.cargo/env"
cargo test -p sietch-policy
```

Eight cases, all passing as of this note.

---

## `main.rs` line by line

File: `crates/policy/src/main.rs`

This file is a CLI. It is **not** what we prove.

```rust
//! Playground. Directory is hardcoded (two demo orgs). You cannot pick a home.

use sietch_policy::{
    evaluate, policy_hash, Book, Delivery, Directory, Policy, Side, CHANI_INSTITUTION,
    PAUL_INSTITUTION,
};
```

`use sietch_policy::…` imports **this crate’s library**. Same folder, two crates-in-one: the lib is a dependency of the binary. Like `import { evaluate } from '@sietch/policy'` inside a script in the same package.

### Parsers

```rust
fn parse_book(raw: &str) -> Result<Book, String> {
    match raw {
        "india" => Ok(Book::India),
        "us" => Ok(Book::Us),
        other => Err(format!("book must be india|us, got {other}")),
    }
}
// parse_side, parse_org, parse_flag — same pattern
```

`&str` = string slice (borrowed text). `Result<T, E>` = `T | Error`. `Ok` / `Err` are the two variants.

These map argv words to types. `chani` → the constant org id. You **cannot** pass `home`. There is no home flag. That is the point.

`format!("… {other}")` is a template string.

### `main`

```rust
fn main() {
    let mut args = std::env::args().skip(1);
    let Some(org_raw) = args.next() else {
        eprintln!(
            "usage: sietch-policy <chani|paul> <out|in> <origin:india|us> <amount> <corridor:open|closed>"
        );
        std::process::exit(2);
    };
```

`fn main()` is `index.ts` at the top level — the process entry.

`std::env::args()` is `process.argv`. `.skip(1)` drops the binary name (like dropping `argv[0]`). `let mut` because we pull args off the iterator.

No first arg → print usage to **stderr** (`eprintln!`, like `console.error`) and exit `2`.

```rust
    let run = (|| {
        let org = parse_org(&org_raw)?;
        let side = parse_side(&args.next().ok_or("missing side")?)?;
        // …
        Ok::<_, String>((org, side, origin, amount, accepts_cross_border))
    })();
```

This is a **closure** `(|| { … })()` — an immediately-invoked function, like `(() => { … })()`. Why? So we can use `?` to bail on parse errors without a giant `match` on every line.

`?` means: if `Err`, return that error from the closure. If `Ok`, unwrap the value.

`.ok_or("missing side")` turns `Option` (maybe no next arg) into `Result`.

`.parse()` on the amount string → `u64`. Fail → “amount must be a number.”

`Ok::<_, String>(tuple)` tells the compiler the error type is `String`.

```rust
    let (org, side, origin, amount, accepts_cross_border) = match run {
        Ok(v) => v,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    };

    let directory = Directory::demo();
    let home = directory.home_of(org).expect("demo orgs are in the directory");
    let policy = Policy { max_amount: 10, accepts_cross_border };
    let delivery = Delivery { amount, origin };
    let allowed = evaluate(&policy, &delivery, side, &directory, org);

    println!("org home (directory, not chosen): {home:?}");
    println!("allowed: {allowed}");
    println!("policy hash: 0x{}", hex::encode(policy_hash(&policy)));
}
```

If parsing failed, print and exit. If it worked, **destructure** the tuple into names.

Then: load the **hardcoded** directory, look up home (CLI only allows `chani` / `paul`, so `expect` is “crash if our demo data is broken”). Build policy + delivery. Call **the same** `evaluate` the tests use. Print.

`{home:?}` uses `Debug`. `hex::encode` is why `hex` is in `[dependencies]` — the CLI prints the hash; the library does not need hex.

### Play commands

```bash
source "$HOME/.cargo/env"
cargo run -p sietch-policy -- chani out india 1 closed   # allow
cargo run -p sietch-policy -- chani out us 1 closed      # deny
cargo run -p sietch-policy -- paul in india 1 closed     # deny (v1)
cargo run -p sietch-policy -- paul in india 1 open       # allow (v2)
```

`--` means “these args are for our program, not for Cargo.”

---

## How the pieces click (for the pitch)

```text
You type argv
    → main.rs parses
        → lib.rs evaluate + policy_hash
            → later: SP1 guest calls those same functions
                → chain verifies the receipt, never sees Policy bytes
```

What Loong should believe: the **library** is the institution’s private rulebook runner. One institution per call. Book comes from a directory they cannot edit. The CLI is only so we can show the function before it is wrapped in a prover.

---

## Honest limits (do not drop these)

- The directory is two rows **we** write. In the demo that is deploy-time data, not a passport.
- Customers still do not prove identity. That is v2.
- There is no fifth “regulator” seat. The directory is not a live console.
