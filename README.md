# ViperNxt

Bun-only [Turborepo](https://turborepo.dev) boilerplate for a Next.js SaaS: one app (`apps/web`), shared UI, Clerk, Zod 4, and Vercel Workflows. Clone it, answer the prompt below, then start building product.

**Requires** [Bun](https://bun.sh) `1.4.x` (see `packageManager` in `package.json`). Installs with anything else will fail (`only-allow bun`).

## Layout

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router (`src/app` routes, `src/features/*` domains, `src/shared`) |
| `packages/ui` | Shared React components (`@repo/ui`) |
| `tooling/typescript-config` | Shared `tsconfig`s |
| `tooling/mocks` | Shared [MSW](https://mswjs.io/) handlers (`@repo/mocks`) |
| `tooling/dependency-cruiser` | Feature-folder import rules |
| `e2e/web` | Playwright for `web` |
| `test/` | `bun test` runner preload only (not a suite) |

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
bun run format-and-lint
```

Lefthook runs Biome, boundaries, and affected typechecks on commit (`lefthook install` via `prepare`).

Clerk keys: copy `apps/web/.env.example` → `apps/web/.env.local`, or use keyless in `next dev`.

## Customize this clone

Paste the following into Cursor (or any coding agent) in this repo. It should **ask these questions one at a time**, then apply the answers. Skip anything you want to leave as-is.

````markdown
You are customizing this ViperNxt clone. Use Bun only (`bun`, `bunx`, `bun test`).
Do not add Vitest, ESLint, or another package manager. Keep feature-folder
boundaries (`app` / `features` / `shared`). After edits: `bun install`,
`bun run check-types`, `bun run check-boundaries`.

Ask one question at a time. Wait for the answer before the next.

1. Product name (human title) and repo/package name (npm-safe, e.g. `acme`)?
   Today the root package is `vipernxt`. Rename `package.json`, README title,
   and any user-facing “ViperNxt” / “Create Next App” copy.

2. Workspace scope instead of `@repo` (e.g. `@acme`)? Update every
   `package.json` `name` / dependency and tsconfig `extends`.

3. Rename `apps/web` (and matching `e2e/web`)? Keep `web` if unsure.
   Update workspace names, Playwright `webDir`, filters, and docs.

4. Extra Next.js apps now (e.g. `marketing`, `admin`)? Scaffold the same
   `src/app` + `src/features` + `src/shared` layout, or skip.

5. Auth: keep Clerk, strip it, or keep it and enable organizations (B2B)?
   Stripping must remove `@clerk/nextjs`, `src/proxy.ts`, `ClerkProvider`,
   `features/auth`, and env examples.

6. Keep Vercel Workflows (`workflow` + `withWorkflow` in `next.config`)?
   Remove the package and wrapper if not.

7. Default site metadata (title, description, `lang` on `<html>`)?

Apply only what was answered. Do not invent a product, database, or UI kit.
````

Later, when you add a database, billing, or shadcn, extend this prompt — those are not in the tree yet.

## Links

- [Turborepo](https://turborepo.dev/docs)
- [Next.js](https://nextjs.org/docs)
- [Clerk](https://clerk.com/docs)
- [Zod](https://zod.dev)
- [Workflow DevKit](https://useworkflow.dev)
- [Biome](https://biomejs.dev)
- [Bun test](https://bun.com/docs/cli/test)
