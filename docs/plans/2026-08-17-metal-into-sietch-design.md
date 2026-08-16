# Metal into Sietch monorepo

Date: 2026-08-17
Audience: Vinay presenting both pillars to Loong from one checkout.
Status: approved — one repo, two products. Not one collapsed demo.

## 1. What this is, in one paragraph

Sietch and Bare Metal are two Metal-inspired pillars with different threat models. Sietch is compliance **without disclosure** (two private institution receipts). Bare Metal is compliance **before funds move** (ERC-8004 identity, AP2 mandate, x402 settlement, on-chain attestation). They already share the same shadcn kit and color tokens. This move copies the full Bare Metal stack into this Turborepo so Vinay can run both from one place for the demo. The two web apps stay separate. The stories stay separate.

**What Loong should believe:** same desk (theme, type, components), two products. Opening Bare Metal does not open Sietch's clip, and the other way around.

## 2. Layout

| Source (`hivinaynair/metal`) | Destination (this repo) | Notes |
|---|---|---|
| `apps/web` | `apps/bare-metal` | Package name `bare-metal`. Dev port **3003** so Sietch keeps 3000. |
| `apps/agent` | `apps/agent` | Eve agent, port 3002. Name kept. |
| `apps/facilitator` | `apps/facilitator` | Hono facilitator, port 3001. Name kept. |
| `packages/db` | `packages/metal-db` | `@repo/metal-db`. Do **not** merge with `@repo/db`. |
| `packages/shared` | `packages/metal-shared` | `@repo/metal-shared`. |
| `packages/ui` | *(not copied)* | Remount onto existing `@repo/ui`. |
| `packages/eslint-config` | *(not copied)* | Biome owns this repo. |
| `packages/typescript-config` | *(not copied)* | Use `@repo/typescript-config`. |
| `contracts/*.sol` + `artifacts/` | `contracts/metal/` | Foundry `src = "src"`, so forge will not compile these. |
| `scripts/` | `packages/metal-scripts` | `@repo/metal-scripts`. Avoids colliding with root `scripts/`. |

Sietch `apps/web`, `apps/modal`, `@repo/db`, `@repo/ui`, and Foundry `contracts/src` are untouched.

## 3. Wiring

One-time snapshot copy. Not a git subtree. `hivinaynair/metal` stays the historical repo.

**Import remaps**

- `@workspace/ui` → `@repo/ui`
- `@workspace/db` → `@repo/metal-db`
- `@workspace/shared` → `@repo/metal-shared`
- `@workspace/typescript-config` → `@repo/typescript-config`

**Tooling alignment**

- Drop Metal eslint / prettier configs and the app-level `components.json` (shadcn lives only in `packages/ui`).
- Rename Metal `typecheck` scripts to `check-types` so root Turbo picks them up.
- Bump Bare Metal Next to `16.3.0` to match Sietch.
- Add `@source` for `apps/bare-metal` in `packages/ui/src/styles/globals.css`.
- Add Metal build env vars to root `turbo.json`.
- `apps/bare-metal/vercel.json` filter becomes `--filter=bare-metal`.

**Do not merge**

- The two Drizzle schemas. Metal has `agents`, `facilitator_config`, `settlement_attestations`. Sietch `@repo/db` stays its own Neon.
- The two contract sets. Clip / T-bill stay Foundry. AttestationRegistry stays solc under `contracts/metal/`.
- The two web apps. No shared routes, no shared Clerk, no shared settlement UI.

**Secrets.** Do not copy `.env.local`. Create `.env.example` files from the env schemas. Metal keeps its own `DATABASE_URL`.

## 4. Runtime

| Process | Port | How to run |
|---|---|---|
| Sietch web | 3000 | `turbo run dev --filter=web` |
| Metal facilitator | 3001 | `turbo run dev --filter=facilitator` |
| Metal agent | 3002 | `turbo run dev --filter=agent` |
| Bare Metal web | 3003 | `turbo run dev --filter=bare-metal` |

`bun run dev` at the root will start every persistent `dev` task, including both web apps. That is acceptable for a demo checkout. Filter when you only want one pillar.

## 5. Verification

This is a copy + remap, not a feature.

- Bring Metal's existing bun tests as-is.
- Do not add a Playwright suite for Bare Metal.
- Do not fold Metal into `e2e/web`.
- `check-boundaries` only cruises Next apps with `src/`. Bare Metal keeps Metal's root `app/` layout, so it is skipped. Leave that alone.
- Success: `bun install`, `turbo run check-types --filter=bare-metal --filter=agent --filter=facilitator --filter=@repo/metal-db --filter=@repo/metal-shared`, and Metal's existing tests pass.

## 6. Docs / pitch

README Related section today says the projects are deliberately separate repos. After this move it should say: **one repo, two products**. Link the live Bare Metal demo. Do not collapse the two sentences into one homepage.
