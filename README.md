# Sietch

Hidden channels under the sand: two institutions settle a tokenized T-bill so the chain learns only `valid` or `invalid` — not the inbound T-bill policy.

Each institution issues its **own** receipt. Settlement is the AND of both. The network never sees the clauses.

Design (read this first): [`docs/plans/2026-08-15-sietch-design.md`](docs/plans/2026-08-15-sietch-design.md).

Not a chain. A stand-in for Metal’s inter-institutional settlement: Next.js settlement room + a tiny SP1 policy guest (one program, two executes), verified on Base Sepolia. Instant means verify, not prove in the browser.

**Requires** [Bun](https://bun.sh) `1.4.x`. Installs with anything else will fail (`only-allow bun`).

## Layout

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router (`src/app` routes, `src/features/*` domains, `src/shared`) |
| `packages/ui` | shadcn/ui (`@repo/ui`) — never install components into `apps/web` |
| `packages/db` | Drizzle ORM + Neon (`@repo/db`) |
| `tooling/typescript-config` | Shared `tsconfig`s |
| `tooling/mocks` | Shared [MSW](https://mswjs.io/) handlers (`@repo/mocks`) |
| `tooling/dependency-cruiser` | Feature-folder import rules |
| `e2e/web` | Playwright for `web` |
| `docs/research` | Notes (e.g. Noir vs SP1) |

Features must not import each other. Compose in `app/`, or hoist to `shared/` / `packages/`. `bun run check-boundaries` enforces that.

## Commands

```sh
bun install
bun run dev              # all apps
bun run build
bun run check-types
bun run check-boundaries
bun test
bunx playwright install chromium   # once
bun run e2e
bun run db generate
bun run db migrate
bun run db push
bun run db studio
bun run ui:add -- button
```
